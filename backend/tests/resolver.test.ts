import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProductResolverService, normalizeUrl } from '../src/services/product-resolver.service';

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
    expect(result.price).toBe(68.00);
    expect(result.brand).toBe('HydroPulse');
  });
});
