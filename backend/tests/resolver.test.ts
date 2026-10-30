import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ProductResolverService,
  normalizeUrl,
  parseShopifyPrice,
  parseJsonLdPrice,
  upgradeToHttps,
  isLogoOrSiteIcon,
  getImageDimensions,
} from '../src/services/product-resolver.service';
import { AppError } from '../src/utils/errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Product Resolver Service & HTML Fixtures', () => {
  const resolver = new ProductResolverService();

  it('normalizes product URLs and strips tracking query parameters', () => {
    const raw = 'https://example.com/products/toy-dollhouse?utm_source=fb&utm_medium=cpc&fbclid=12345&color=pink';
    const normalized = normalizeUrl(raw);
    expect(normalized).toBe('https://example.com/products/toy-dollhouse?color=pink');
  });

  it('extracts rich product metadata from Shopify HTML fixture (JSON-LD + OG)', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/shopify-product.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const result = resolver.extractFromHtml(html, 'https://pastelplay.co/products/wooden-dollhouse');

    expect(result.title).toBe('Wooden Deluxe Dollhouse');
    expect(result.description).toContain('Handcrafted three-storey miniature wooden dollhouse');
    expect(result.imageUrl).toBe('https://cdn.shopify.com/s/files/1/dollhouse_front.jpg');
    expect(result.brand).toBe('Pastel Play Co.');
    expect(result.price).toBe(149.99);
    expect(result.currency).toBe('USD');
    expect(result.metadata.jsonLd).toBeDefined();
  });

  it('extracts product metadata from Amazon-like HTML fixture (#productTitle + landingImage)', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/amazon-product.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const result = resolver.extractFromHtml(html, 'https://amazon.com/dp/B08XYZ1234');

    expect(result.title).toContain('SonicPro Wireless Over-Ear Active Noise Cancelling Headphones');
    expect(result.imageUrl).toBeDefined();
    expect(result.imageUrl).toContain('71xyz');
  });

  it('extracts product metadata from generic OpenGraph HTML fixture', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/generic-og-product.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const result = resolver.extractFromHtml(html, 'https://hydropulse.com/bottle-24oz');

    expect(result.title).toBe('HydroPulse 24oz Insulated Stainless Steel Smart Water Bottle');
    expect(result.description).toContain('Double-wall vacuum insulated smart water bottle');
    expect(result.imageUrl).toBe('https://images.example.com/products/hydropulse_sage.jpg');
    expect(result.price).toBe(68.0);
    expect(result.brand).toBe('HydroPulse');
  });

  // --- REQUIREMENT 1: RESOLVER FAILURES ---

  it('rejects 404 error page fixture with code PRODUCT_EXTRACTION_FAILED (retryable: false)', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/404-page.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    expect(() => {
      resolver.extractFromHtml(html, 'https://example.com/products/missing-item');
    }).toThrowError(AppError);

    try {
      resolver.extractFromHtml(html, 'https://example.com/products/missing-item');
    } catch (err: any) {
      expect(err.code).toBe('PRODUCT_EXTRACTION_FAILED');
      expect(err.retryable).toBe(false);
      expect(err.statusCode).toBe(422);
    }
  });

  it('rejects bot challenge / captcha page fixture with code PRODUCT_EXTRACTION_FAILED (retryable: false)', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/captcha-page.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    expect(() => {
      resolver.extractFromHtml(html, 'https://example.com/products/blocked-item');
    }).toThrowError(AppError);

    try {
      resolver.extractFromHtml(html, 'https://example.com/products/blocked-item');
    } catch (err: any) {
      expect(err.code).toBe('PRODUCT_EXTRACTION_FAILED');
      expect(err.retryable).toBe(false);
      expect(err.statusCode).toBe(422);
    }
  });

  it('rejects pages with no product signals (no JSON-LD Product, no og:type, no price, no add-to-cart)', () => {
    const blogHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>About Us - Our Team Story</title></head>
        <body>
          <h1>Our Story</h1>
          <p>We build great things for developers worldwide.</p>
        </body>
      </html>
    `;

    expect(() => {
      resolver.extractFromHtml(blogHtml, 'https://example.com/about');
    }).toThrowError(AppError);

    try {
      resolver.extractFromHtml(blogHtml, 'https://example.com/about');
    } catch (err: any) {
      expect(err.code).toBe('PRODUCT_EXTRACTION_FAILED');
      expect(err.retryable).toBe(false);
    }
  });

  it('rejects logo-only og:image, selects gallery image, and upgrades http to https', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/logo-only-og.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');

    const result = resolver.extractFromHtml(html, 'https://velocity.com/products/aerostride');

    expect(result.title).toBe('AeroStride Pro Running Shoes');
    // Rejected http://cdn.velocity.com/assets/brand-logo.png
    expect(result.imageUrl).not.toContain('brand-logo');
    expect(result.imageUrl).not.toContain('site-favicon');
    // Selected product gallery image and upgraded http to https
    expect(result.imageUrl).toBe('https://cdn.velocity.com/products/aerostride-runner-navy.jpg');
    expect(result.imageUrl?.startsWith('https://')).toBe(true);
  });

  // --- REQUIREMENT 2: PRICE PARSING (Shopify integer cents vs JSON-LD decimal strings) ---

  describe('Price Parsing Helpers', () => {
    it('correctly parses Shopify integer cents format into decimal price', () => {
      expect(parseShopifyPrice(3100)).toBe(31.0);
      expect(parseShopifyPrice(1600)).toBe(16.0);
      expect(parseShopifyPrice('3100')).toBe(31.0);
      expect(parseShopifyPrice('14999')).toBe(149.99);
      expect(parseShopifyPrice(250)).toBe(2.5);
    });

    it('correctly parses JSON-LD decimal string and numeric formats', () => {
      expect(parseJsonLdPrice('31.00')).toBe(31.0);
      expect(parseJsonLdPrice('31.99')).toBe(31.99);
      expect(parseJsonLdPrice(31.0)).toBe(31.0);
      expect(parseJsonLdPrice('$149.99')).toBe(149.99);
      expect(parseJsonLdPrice('₹3,100.00')).toBe(3100.0);
      expect(parseJsonLdPrice(undefined)).toBeUndefined();
    });
  });

  // --- REQUIREMENT 3: TITLE QUALITY & BRAND REJECTION ---

  describe('Title Quality & Brand Rejection', () => {
    it('rejects candidate titles that are only the brand or site name', () => {
      const brandOnlyHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Anker | Charge Fast, Live More - Anker US</title>
            <meta property="og:title" content="Anker" />
            <meta property="og:type" content="product" />
            <meta property="product:brand" content="Anker" />
            <meta property="product:price:amount" content="49.99" />
          </head>
          <body>
            <h1>Anker</h1>
            <button name="add">Add to Cart</button>
          </body>
        </html>
      `;

      expect(() => {
        resolver.extractFromHtml(brandOnlyHtml, 'https://www.anker.com/products/a3102');
      }).toThrowError(AppError);

      try {
        resolver.extractFromHtml(brandOnlyHtml, 'https://www.anker.com/products/a3102');
      } catch (err: any) {
        expect(err.code).toBe('PRODUCT_EXTRACTION_FAILED');
        expect(err.retryable).toBe(false);
      }
    });

    it('prefers JSON-LD Product name over og:title and h1', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Brand Store - Over-Ear</title>
            <meta property="og:title" content="OG SoundCore Headset" />
            <meta property="og:type" content="product" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Soundcore Space One Pro Wireless Headphones",
                "offers": { "@type": "Offer", "price": "199.99", "priceCurrency": "USD" }
              }
            </script>
          </head>
          <body>
            <h1>H1 Soundcore</h1>
            <button name="add">Add to Cart</button>
          </body>
        </html>
      `;

      const result = resolver.extractFromHtml(html, 'https://example.com/products/space-one');
      expect(result.title).toBe('Soundcore Space One Pro Wireless Headphones');
    });
  });

  // --- IMAGE DIMENSIONS & LOGO DETECTION ---

  describe('Image Helpers', () => {
    it('detects logo, favicon, and sprite filenames', () => {
      expect(isLogoOrSiteIcon('https://site.com/images/company-logo.svg')).toBe(true);
      expect(isLogoOrSiteIcon('https://site.com/assets/favicon.ico')).toBe(true);
      expect(isLogoOrSiteIcon('https://site.com/icons/nav-sprite.png')).toBe(true);
      expect(isLogoOrSiteIcon('https://site.com/products/sneaker-main.jpg')).toBe(false);
    });

    it('upgrades http and protocol-relative image URLs to https', () => {
      expect(upgradeToHttps('http://site.com/img.jpg')).toBe('https://site.com/img.jpg');
      expect(upgradeToHttps('//cdn.site.com/img.jpg')).toBe('https://cdn.site.com/img.jpg');
      expect(upgradeToHttps('https://site.com/img.jpg')).toBe('https://site.com/img.jpg');
    });

    it('reads binary image dimensions from PNG and GIF headers and flags small images', () => {
      // 1x1 GIF
      const smallGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      const gifDims = getImageDimensions(smallGif);
      expect(gifDims).toEqual({ width: 1, height: 1 });
      expect(gifDims!.width < 200 || gifDims!.height < 200).toBe(true);

      // PNG buffer with width 800, height 600
      const pngHeader = Buffer.alloc(32);
      pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      pngHeader.writeUInt32BE(800, 16);
      pngHeader.writeUInt32BE(600, 20);
      const pngDims = getImageDimensions(pngHeader);
      expect(pngDims).toEqual({ width: 800, height: 600 });
      expect(pngDims!.width >= 200 && pngDims!.height >= 200).toBe(true);
    });
  });
});
