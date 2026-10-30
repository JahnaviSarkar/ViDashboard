import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { URL } from 'url';
import { safeFetch } from '../utils/ssrf';
import { CacheRepository } from '../db/repositories/cache.repository';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface ResolvedProduct {
  title: string;
  description?: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
  imageHash?: string;
  brand?: string;
  price?: number;
  currency?: string;
  sourceUrl: string;
  metadata: Record<string, unknown>;
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    // Remove tracking query params like utm_*, fbclid, gclid, ref
    const cleanParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!key.startsWith('utm_') && key !== 'fbclid' && key !== 'gclid' && key !== 'ref') {
        cleanParams.append(key, value);
      }
    }
    parsed.search = cleanParams.toString();
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

export class ProductResolverService {
  constructor(private cacheRepo = new CacheRepository()) {}

  async resolve(productUrl: string): Promise<ResolvedProduct> {
    const normalized = normalizeUrl(productUrl);
    const cacheKey = `url_resolve:${normalized}`;

    // 1. Check cache first
    try {
      const cached = await this.cacheRepo.get<ResolvedProduct>(cacheKey);
      if (cached) {
        logger.info({ url: normalized }, 'Product resolution cache hit');
        return cached;
      }
    } catch (err) {
      logger.warn({ err }, 'Cache lookup failed, proceeding to fetch URL');
    }

    logger.info({ url: normalized }, 'Fetching product page for resolution');

    // 2. Fetch page HTML safely via SSRF guard
    let pageHtml = '';
    let finalUrl = normalized;

    try {
      const res = await safeFetch(normalized, {
        timeoutMs: 12000,
        maxBytes: 5 * 1024 * 1024, // 5MB
      });
      pageHtml = res.text;
      finalUrl = res.finalUrl;
    } catch (err: any) {
      logger.error({ err, url: normalized }, 'Safe fetch failed for product page');
      throw new AppError('URL_RESOLVE_FAILED', `Failed to fetch product URL: ${err.message}`, 502, { originalUrl: normalized }, true);
    }

    // 3. Extract product information
    const extracted = await this.extractFromHtml(pageHtml, finalUrl);

    // If Shopify site, attempt enrichment via /products/:handle.js
    if (finalUrl.includes('/products/')) {
      try {
        const enrichedShopify = await this.enrichShopify(finalUrl);
        if (enrichedShopify) {
          if (!extracted.title || extracted.title === 'Product') extracted.title = enrichedShopify.title || extracted.title;
          if (!extracted.description) extracted.description = enrichedShopify.description;
          if (!extracted.imageUrl) extracted.imageUrl = enrichedShopify.imageUrl;
          if (!extracted.brand) extracted.brand = enrichedShopify.brand;
          if (!extracted.price) extracted.price = enrichedShopify.price;
          extracted.metadata.shopify = enrichedShopify.metadata;
        }
      } catch (err) {
        logger.debug({ err }, 'Shopify JSON fallback skipped or failed');
      }
    }

    if (!extracted.title) {
      throw new AppError('URL_RESOLVE_FAILED', 'Could not extract product title from the provided page', 422, { url: finalUrl }, true);
    }

    // 4. Download and validate image if present
    if (extracted.imageUrl) {
      try {
        const resolvedImageUrl = new URL(extracted.imageUrl, finalUrl).toString();
        const imgRes = await safeFetch(resolvedImageUrl, {
          timeoutMs: 10000,
          maxBytes: 10 * 1024 * 1024, // 10MB image limit
        });

        if (imgRes.buffer.length > 0) {
          extracted.imageBuffer = imgRes.buffer;
          extracted.imageHash = crypto.createHash('sha256').update(imgRes.buffer).digest('hex');
          extracted.imageUrl = resolvedImageUrl;
        }
      } catch (imgErr) {
        logger.warn({ imgErr, imageUrl: extracted.imageUrl }, 'Failed to download product image, continuing with URL only');
      }
    }

    // 5. Cache resolved product (1 hour TTL)
    try {
      const serializableProduct: ResolvedProduct = {
        ...extracted,
        imageBuffer: undefined, // Don't cache raw buffer in JSON table
      };
      await this.cacheRepo.set(cacheKey, serializableProduct, 3600);
    } catch (err) {
      logger.warn({ err }, 'Failed to cache product resolution');
    }

    return extracted;
  }

  /**
   * Extracts metadata from HTML using JSON-LD, OpenGraph, Amazon heuristics, and standard DOM elements.
   */
  public extractFromHtml(html: string, baseUrl: string): ResolvedProduct {
    const $ = cheerio.load(html);

    let title: string | undefined;
    let description: string | undefined;
    let imageUrl: string | undefined;
    let brand: string | undefined;
    let price: number | undefined;
    let currency: string | undefined;
    const metadata: Record<string, unknown> = {};

    // A. Strategy 1: JSON-LD Product Schema
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const rawJson = $(elem).html();
        if (!rawJson) return;
        const parsed = JSON.parse(rawJson);
        const candidates = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];

        for (const item of candidates) {
          const type = item['@type'];
          if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
            metadata.jsonLd = item;
            if (!title && item.name) title = String(item.name).trim();
            if (!description && item.description) description = String(item.description).trim();

            if (!imageUrl && item.image) {
              if (typeof item.image === 'string') imageUrl = item.image;
              else if (Array.isArray(item.image) && item.image[0]) {
                imageUrl = typeof item.image[0] === 'string' ? item.image[0] : item.image[0].url;
              } else if (item.image.url) {
                imageUrl = item.image.url;
              }
            }

            if (!brand && item.brand) {
              brand = typeof item.brand === 'string' ? item.brand : item.brand.name;
            }

            if (!price && item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price) {
                price = parseFloat(offer.price);
                currency = offer.priceCurrency;
              }
            }
          }
        }
      } catch {
        // Skip malformed JSON-LD scripts
      }
    });

    // B. Strategy 2: OpenGraph & Twitter Meta Tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || $('meta[name="description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    const ogPrice = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
    const ogBrand = $('meta[property="product:brand"]').attr('content');

    if (!title && ogTitle) title = ogTitle.trim();
    if (!description && ogDesc) description = ogDesc.trim();
    if (!imageUrl && ogImage) imageUrl = ogImage.trim();
    if (!brand && ogBrand) brand = ogBrand.trim();
    if (!price && ogPrice) price = parseFloat(ogPrice);

    // C. Strategy 3: Amazon Specific Heuristics
    const amazonTitle = $('#productTitle').text().trim();
    if (amazonTitle && (!title || amazonTitle.length > title.length)) {
      title = amazonTitle;
    }

    const amazonLandingImg = $('#landingImage, #imgBlkFront').attr('src') || $('#landingImage, #imgBlkFront').attr('data-old-hires');
    if (!imageUrl && amazonLandingImg) {
      imageUrl = amazonLandingImg.trim();
    }

    // Check Amazon dynamic images JSON
    const dynamicImageAttr = $('#landingImage').attr('data-a-dynamic-image');
    if (!imageUrl && dynamicImageAttr) {
      try {
        const dynObj = JSON.parse(dynamicImageAttr);
        const keys = Object.keys(dynObj);
        if (keys.length > 0) imageUrl = keys[0];
      } catch {}
    }

    // D. Strategy 4: Generic DOM Fallbacks
    if (!title) {
      title = $('h1').first().text().trim() || $('title').text().trim();
    }

    if (!imageUrl) {
      // Find largest img with plausible product classes or attributes
      const candidateImages: string[] = [];
      $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('tracking')) {
          candidateImages.push(src);
        }
      });
      if (candidateImages.length > 0) {
        imageUrl = candidateImages[0];
      }
    }

    // Clean up title
    if (title) {
      // Strip common store suffix e.g. "Wooden Toy - Brand Name"
      title = title.replace(/\s*\|\s*.*$/, '').replace(/\s*-\s*Amazon\.com.*$/, '').trim();
    }

    return {
      title: title || 'Product',
      description,
      imageUrl,
      brand,
      price,
      currency,
      sourceUrl: baseUrl,
      metadata,
    };
  }

  /**
   * Attempts to fetch Shopify .js endpoint for rich product data
   */
  private async enrichShopify(url: string): Promise<Partial<ResolvedProduct> | null> {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/products\/([a-zA-Z0-9_-]+)/);
      if (!match) return null;

      const handle = match[1];
      const shopifyEndpoint = `${parsed.origin}/products/${handle}.js`;

      const res = await safeFetch(shopifyEndpoint, { timeoutMs: 5000 });
      if (res.statusCode === 200) {
        const data = JSON.parse(res.text);
        return {
          title: data.title,
          description: data.description,
          imageUrl: data.featured_image || (data.images && data.images[0]),
          brand: data.vendor,
          price: data.price ? data.price / 100 : undefined,
          metadata: { shopifyHandle: handle, variants: data.variants?.length },
        };
      }
    } catch {
      // Ignore Shopify endpoint errors
    }
    return null;
  }
}
