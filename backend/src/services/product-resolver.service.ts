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

export const ERROR_PAGE_REGEX = /404|not found|access denied|captcha|robot check|just a moment/i;

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

export function upgradeToHttps(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith('http://')) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  return trimmed;
}

export function isLogoOrSiteIcon(url?: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return /(logo|favicon|sprite)/i.test(lower);
}

export function parseShopifyPrice(rawPrice: number | string | undefined | null): number | undefined {
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') return undefined;
  if (typeof rawPrice === 'number') {
    if (Number.isInteger(rawPrice)) {
      return rawPrice / 100;
    }
    return rawPrice;
  }
  const cleanStr = String(rawPrice).replace(/[^0-9.]/g, '');
  if (!cleanStr) return undefined;
  if (cleanStr.includes('.')) {
    return parseFloat(cleanStr);
  }
  return parseInt(cleanStr, 10) / 100;
}

export function parseJsonLdPrice(rawPrice: number | string | undefined | null): number | undefined {
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') return undefined;
  if (typeof rawPrice === 'number') return rawPrice;
  const cleanStr = String(rawPrice).replace(/[^0-9.]/g, '');
  if (!cleanStr) return undefined;
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? undefined : parsed;
}

export function getImageDimensions(buffer?: Buffer): { width: number; height: number } | null {
  if (!buffer || buffer.length < 10) return null;

  // PNG
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // GIF
  if (buffer.length >= 10 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { width, height };
  }

  // JPEG
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }

  // WebP
  if (buffer.length >= 30 && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
    const chunkType = buffer.slice(12, 16).toString();
    if (chunkType === 'VP8X' && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height };
    }
    if (chunkType === 'VP8 ' && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    if (chunkType === 'VP8L' && buffer.length >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (b0 | ((b1 & 0x3f) << 8));
      const height = 1 + (((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)));
      return { width, height };
    }
  }

  return null;
}

function isOnlyBrandOrSiteName(title: string, brand?: string, siteName?: string, domainBrand?: string): boolean {
  const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const tNorm = normalize(title);
  if (!tNorm) return true;

  const forbidden = [
    normalize(brand),
    normalize(siteName),
    normalize(domainBrand),
    'product',
    'item',
    'homepage',
    'shop',
    'store',
  ].filter(Boolean);

  return forbidden.includes(tNorm);
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

      // REQUIREMENT 1: Reject error pages. Fail with PRODUCT_EXTRACTION_FAILED (retryable: false) on non-2xx HTTP status
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new AppError(
          'PRODUCT_EXTRACTION_FAILED',
          `Product page returned non-2xx HTTP status: ${res.statusCode}`,
          422,
          { statusCode: res.statusCode, url: normalized },
          false
        );
      }

      pageHtml = res.text;
      finalUrl = res.finalUrl;
    } catch (err: any) {
      if (err instanceof AppError && err.code === 'PRODUCT_EXTRACTION_FAILED') {
        throw err;
      }
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
          if (enrichedShopify.price !== undefined) extracted.price = enrichedShopify.price;
          extracted.metadata.shopify = enrichedShopify.metadata;
        }
      } catch (err) {
        logger.debug({ err }, 'Shopify JSON fallback skipped or failed');
      }
    }

    if (!extracted.title) {
      throw new AppError('PRODUCT_EXTRACTION_FAILED', 'Could not extract product title from the provided page', 422, { url: finalUrl }, false);
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
          const dims = getImageDimensions(imgRes.buffer);
          if (dims && (dims.width < 200 || dims.height < 200)) {
            logger.warn({ dims, imageUrl: resolvedImageUrl }, 'Image rejected: dimensions smaller than 200x200 px');
            extracted.imageBuffer = undefined;
            extracted.imageHash = undefined;
            extracted.imageUrl = undefined;
          } else {
            extracted.imageBuffer = imgRes.buffer;
            extracted.imageHash = crypto.createHash('sha256').update(imgRes.buffer).digest('hex');
            extracted.imageUrl = resolvedImageUrl;
          }
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

    // REQUIREMENT 1: Fail with PRODUCT_EXTRACTION_FAILED (retryable: false) when:
    // the title or h1 matches /404|not found|access denied|captcha|robot check|just a moment/i
    const rawTitleTag = $('title').text().trim();
    const rawH1Text = $('h1').map((_, el) => $(el).text().trim()).get().join(' ');

    if (ERROR_PAGE_REGEX.test(rawTitleTag) || ERROR_PAGE_REGEX.test(rawH1Text)) {
      throw new AppError(
        'PRODUCT_EXTRACTION_FAILED',
        `Product page rejected: error page or bot-challenge detected in title/h1 ("${rawTitleTag || rawH1Text}")`,
        422,
        { url: baseUrl },
        false
      );
    }

    let parsedHostname = '';
    let domainBrand = '';
    try {
      parsedHostname = new URL(baseUrl).hostname.toLowerCase();
      const parts = parsedHostname.split('.');
      domainBrand = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    } catch {}

    let jsonLdTitle: string | undefined;
    let jsonLdDesc: string | undefined;
    let jsonLdBrand: string | undefined;
    let jsonLdPrice: number | undefined;
    let jsonLdCurrency: string | undefined;
    const jsonLdImages: string[] = [];
    const metadata: Record<string, unknown> = {};

    let hasJsonLdProduct = false;

    // A. Strategy 1: JSON-LD Product Schema
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const rawJson = $(elem).html();
        if (!rawJson) return;
        const parsed = JSON.parse(rawJson);
        const candidates = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];

        for (const item of candidates) {
          const type = item['@type'];
          const isProductType =
            type === 'Product' ||
            type === 'ProductGroup' ||
            (Array.isArray(type) && (type.includes('Product') || type.includes('ProductGroup')));

          if (isProductType) {
            hasJsonLdProduct = true;
            metadata.jsonLd = item;

            if (!jsonLdTitle && item.name) jsonLdTitle = String(item.name).trim();
            if (!jsonLdDesc && item.description) jsonLdDesc = String(item.description).trim();

            if (item.image) {
              if (typeof item.image === 'string') jsonLdImages.push(item.image);
              else if (Array.isArray(item.image)) {
                for (const img of item.image) {
                  if (typeof img === 'string') jsonLdImages.push(img);
                  else if (img?.url) jsonLdImages.push(img.url);
                }
              } else if (item.image.url) {
                jsonLdImages.push(item.image.url);
              }
            }

            if (!jsonLdBrand && item.brand) {
              jsonLdBrand = typeof item.brand === 'string' ? item.brand : item.brand.name;
            }

            if (jsonLdPrice === undefined && item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price !== undefined) {
                jsonLdPrice = parseJsonLdPrice(offer.price);
                jsonLdCurrency = offer.priceCurrency;
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
    const ogPriceStr = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
    const ogCurrency = $('meta[property="product:price:currency"]').attr('content') || $('meta[property="og:price:currency"]').attr('content') || $('meta[name="twitter:price:currency"]').attr('content');
    const ogBrand = $('meta[property="product:brand"]').attr('content');
    const siteName = $('meta[property="og:site_name"]').attr('content');
    const ogType = $('meta[property="og:type"]').attr('content') || '';

    const hasOgTypeProduct = /product/i.test(ogType);

    // C. Strategy 3: Amazon Specific Heuristics
    const amazonTitle = $('#productTitle').text().trim();
    const amazonLandingImg = $('#landingImage, #imgBlkFront').attr('src') || $('#landingImage, #imgBlkFront').attr('data-old-hires');

    // D. Price & Currency resolution
    let finalPrice: number | undefined = jsonLdPrice;
    let finalCurrency: string | undefined = jsonLdCurrency;

    if (finalPrice === undefined && ogPriceStr) {
      finalPrice = parseJsonLdPrice(ogPriceStr);
    }
    if (!finalCurrency && ogCurrency) {
      finalCurrency = ogCurrency.toUpperCase().trim();
    }

    // Check Amazon DOM price if still undefined
    if (finalPrice === undefined) {
      const amazonPriceWhole = $('.a-price .a-price-whole').first().text().replace(/[^0-9]/g, '');
      const amazonPriceFraction = $('.a-price .a-price-fraction').first().text().replace(/[^0-9]/g, '');
      if (amazonPriceWhole) {
        finalPrice = parseFloat(`${amazonPriceWhole}.${amazonPriceFraction || '00'}`);
      }
      const amazonCurrencySymbol = $('.a-price .a-price-symbol').first().text().trim();
      if (amazonCurrencySymbol) {
        if (amazonCurrencySymbol === '$') finalCurrency = 'USD';
        else if (amazonCurrencySymbol === '₹') finalCurrency = 'INR';
        else if (amazonCurrencySymbol === '£') finalCurrency = 'GBP';
        else if (amazonCurrencySymbol === '€') finalCurrency = 'EUR';
      }
    }

    // E. Add to Cart signal detection
    let hasAddToCart = false;
    const addToCartSelectors = [
      'button[name="add"]',
      'input[name="add"]',
      'button[id*="add-to-cart" i]',
      'button[id*="addToCart" i]',
      'button[class*="add-to-cart" i]',
      'button[class*="addToCart" i]',
      'a[id*="add-to-cart" i]',
      'form[action*="/cart/add"]',
      '#add-to-cart-button',
      '#buy-now-button',
      '[data-action="add-to-cart"]',
      '[data-testid*="add-to-cart" i]',
      '[aria-label*="Add to bag" i]',
      '[aria-label*="Add to cart" i]',
    ];

    if ($(addToCartSelectors.join(',')).length > 0) {
      hasAddToCart = true;
    } else {
      $('button, input[type="submit"], a.btn, a.button').each((_, el) => {
        const text = $(el).text().trim() || $(el).attr('value') || '';
        if (/add to (cart|bag)|buy (it )?now|order now/i.test(text)) {
          hasAddToCart = true;
        }
      });
    }

    const hasPrice = finalPrice !== undefined && !isNaN(finalPrice) && finalPrice > 0;

    // REQUIREMENT 1: Fail with PRODUCT_EXTRACTION_FAILED (retryable: false) when:
    // no product signals exist (no JSON-LD Product, no og:type product, no price, no add-to-cart)
    if (!hasJsonLdProduct && !hasOgTypeProduct && !hasPrice && !hasAddToCart) {
      throw new AppError(
        'PRODUCT_EXTRACTION_FAILED',
        'No product signals detected on page (no JSON-LD Product, no og:type product, no price, no add-to-cart)',
        422,
        { url: baseUrl },
        false
      );
    }

    // Brand resolution
    const finalBrand = jsonLdBrand || ogBrand || (amazonTitle ? 'Amazon' : undefined);

    // REQUIREMENT 3: TITLE QUALITY
    // Prefer JSON-LD Product name, then og:title, then h1, and reject titles that are only the brand or site name.
    const titleCandidates: Array<{ source: string; value?: string }> = [
      { source: 'amazonTitle', value: amazonTitle },
      { source: 'jsonLd', value: jsonLdTitle },
      { source: 'ogTitle', value: ogTitle },
      { source: 'h1', value: $('h1').first().text().trim() },
      { source: 'titleTag', value: rawTitleTag },
    ];

    let chosenTitle: string | undefined;
    for (const cand of titleCandidates) {
      if (!cand.value) continue;
      let cleaned = cand.value.trim();
      // Strip common store suffix e.g. "Product Title | Brand", "Product Title - Store"
      cleaned = cleaned.replace(/\s*\|\s*.*$/, '').replace(/\s*-\s*Amazon\..*$/i, '').trim();

      if (!cleaned) continue;
      if (ERROR_PAGE_REGEX.test(cleaned)) continue;
      if (isOnlyBrandOrSiteName(cleaned, finalBrand, siteName, domainBrand)) {
        continue;
      }
      chosenTitle = cleaned;
      break;
    }

    if (!chosenTitle) {
      throw new AppError(
        'PRODUCT_EXTRACTION_FAILED',
        'Could not extract a valid product title (all candidates rejected as brand-only, error, or empty)',
        422,
        { url: baseUrl },
        false
      );
    }

    // Image resolution: Prefer product gallery image, reject logos and icons
    const imageCandidates: string[] = [];

    // 1. Amazon images
    if (amazonLandingImg) imageCandidates.push(amazonLandingImg);
    const dynamicImageAttr = $('#landingImage').attr('data-a-dynamic-image');
    if (dynamicImageAttr) {
      try {
        const dynObj = JSON.parse(dynamicImageAttr);
        for (const k of Object.keys(dynObj)) imageCandidates.push(k);
      } catch {}
    }

    // 2. Product gallery images
    const gallerySelectors = [
      '.product__media img',
      '.product-single__photo img',
      '[data-product-image]',
      '.product-image img',
      'img[data-zoom-image]',
      '[class*="gallery" i] img',
      '[class*="product-gallery" i] img',
      'img[itemprop="image"]',
    ];
    $(gallerySelectors.join(',')).each((_, el) => {
      const src = $(el).attr('data-zoom-image') || $(el).attr('data-src') || $(el).attr('src');
      const w = parseInt($(el).attr('width') || '0', 10);
      const h = parseInt($(el).attr('height') || '0', 10);
      if (src && (w === 0 || w >= 200) && (h === 0 || h >= 200)) {
        imageCandidates.push(src);
      }
    });

    // 3. JSON-LD images
    for (const img of jsonLdImages) {
      if (img) imageCandidates.push(img);
    }

    // 4. OpenGraph image (if not logo/icon)
    if (ogImage) {
      imageCandidates.push(ogImage);
    }

    // 5. Generic page images
    $('img').each((_, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src');
      const w = parseInt($(el).attr('width') || '0', 10);
      const h = parseInt($(el).attr('height') || '0', 10);
      if (src && (w === 0 || w >= 200) && (h === 0 || h >= 200)) {
        imageCandidates.push(src);
      }
    });

    let chosenImageUrl: string | undefined;
    for (const cand of imageCandidates) {
      if (cand && !isLogoOrSiteIcon(cand)) {
        chosenImageUrl = upgradeToHttps(cand);
        break;
      }
    }

    return {
      title: chosenTitle,
      description: jsonLdDesc || ogDesc,
      imageUrl: chosenImageUrl,
      brand: finalBrand,
      price: finalPrice,
      currency: finalCurrency,
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
        const shopifyImg = data.featured_image || (data.images && data.images[0]);
        return {
          title: data.title,
          description: data.description,
          imageUrl: isLogoOrSiteIcon(shopifyImg) ? undefined : upgradeToHttps(shopifyImg),
          brand: data.vendor,
          price: parseShopifyPrice(data.price),
          metadata: { shopifyHandle: handle, variants: data.variants?.length },
        };
      }
    } catch {
      // Ignore Shopify endpoint errors
    }
    return null;
  }
}
