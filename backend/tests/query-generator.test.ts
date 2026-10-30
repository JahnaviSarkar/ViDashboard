import { describe, it, expect } from 'vitest';
import { QueryGeneratorService, isValidHashtag } from '../src/services/query-generator.service';
import { ProductAnalysis } from '../src/providers/vision/types';

describe('Query Generation Service and Expansion Tiers', () => {
  const generator = new QueryGeneratorService();

  const sampleAnalysis: ProductAnalysis = {
    productType: 'Wooden Miniature Dollhouse',
    category: 'Toys & Games / Pretend Play',
    dominantColour: 'Rose Pink',
    secondaryColours: ['Pastel Mint'],
    printsAndGraphics: [],
    logos: ['PastelPlay'],
    visibleText: [],
    material: 'Solid Beech Wood',
    shape: 'Three-storey cottage with pitched roof',
    distinguishingAttributes: ['Modular room partitions', 'Non-toxic glaze'],
    attributeConfidence: { productType: 0.95 },
    isTextDerived: false,
  };

  it('generates ranked Instagram hashtags with broad and niche mix', () => {
    const queries = generator.generate(sampleAnalysis, 'Pastel Play Co.');

    expect(queries.instagram.hashtags.length).toBeGreaterThan(5);

    // Niche hashtags
    expect(queries.instagram.hashtags).toContain('#woodenminiaturedollhouse');
    expect(queries.instagram.hashtags).toContain('#pastelplayco');

    // Broad category hashtags
    expect(queries.instagram.hashtags.some((h) => h.includes('toys') || h.includes('pretendplay'))).toBe(true);
    expect(queries.instagram.hashtags).toContain('#productfinds');
  });

  it('generates commercial Meta Ad Library search terms', () => {
    const queries = generator.generate(sampleAnalysis, 'Pastel Play Co.');

    expect(queries.meta.searchTerms).toContain('Pastel Play Co.');
    expect(queries.meta.searchTerms).toContain('Wooden Miniature Dollhouse');
    expect(queries.meta.searchTerms.some((t) => t.includes('sale') || t.includes('Rose Pink'))).toBe(true);
  });

  it('produces distinct 3-tier expansion strategy for progressive shortfall recovery', () => {
    const queries = generator.generate(sampleAnalysis, 'Pastel Play Co.');

    // Tier 1 (Exact): Brand + specific product type + primary feature
    expect(queries.expansionTiers.tier1.length).toBeGreaterThan(0);
    expect(queries.expansionTiers.tier1).toContain('Pastel Play Co. Wooden Miniature Dollhouse');
    expect(queries.expansionTiers.tier1).toContain('Wooden Miniature Dollhouse');

    // Tier 2 (Attribute-Broadened): Color + Material + Shape
    expect(queries.expansionTiers.tier2.length).toBeGreaterThan(0);
    expect(queries.expansionTiers.tier2).toContain('Rose Pink Wooden Miniature Dollhouse');
    expect(queries.expansionTiers.tier2).toContain('Solid Beech Wood Wooden Miniature Dollhouse');

    // Tier 3 (Category-Level): Broad category keywords
    expect(queries.expansionTiers.tier3.length).toBeGreaterThan(0);
    expect(queries.expansionTiers.tier3.some((t) => t.includes('toys') || t.includes('pretendplay'))).toBe(true);
  });

  it('filters out generic mock hashtags like #compositeblendproducts and #ergonomicpremium', () => {
    const analysisWithGenericProps: ProductAnalysis = {
      productType: 'Item',
      category: 'General',
      dominantColour: 'Neutral',
      secondaryColours: [],
      printsAndGraphics: [],
      logos: [],
      visibleText: [],
      material: 'Composite Blend',
      shape: 'Standard',
      distinguishingAttributes: ['Ergonomic premium construction', 'Minimalist aesthetic'],
      attributeConfidence: {},
      isTextDerived: true,
      isMock: true,
    };

    const queries = generator.generate(analysisWithGenericProps);

    expect(queries.instagram.hashtags).not.toContain('#compositeblendproducts');
    expect(queries.instagram.hashtags).not.toContain('#compositeblend');
    expect(queries.instagram.hashtags).not.toContain('#ergonomicpremium');
    expect(queries.instagram.hashtags).not.toContain('#ergonomicpremiumproducts');
  });

  describe('Hashtag Quality & Validation', () => {
    it('accepts short, searchable concept hashtags', () => {
      expect(isValidHashtag('#lipgloss')).toBe(true);
      expect(isValidHashtag('#fentybeauty')).toBe(true);
      expect(isValidHashtag('#oversizedtank')).toBe(true);
      expect(isValidHashtag('#techwear')).toBe(true);
      expect(isValidHashtag('#dollhouse')).toBe(true);
    });

    it('rejects hashtags longer than 25 characters', () => {
      expect(isValidHashtag('#verylongunsearchablehashtagname12345')).toBe(false);
      expect(isValidHashtag('#thisiswaytoolongtoeverworkasahashtag')).toBe(false);
      expect(isValidHashtag('#twentyfivecharacterstag1')).toBe(true); // length 25
      expect(isValidHashtag('#twentyfivecharacterstag12')).toBe(false); // length 26
    });

    it('rejects hashtags containing the word "products"', () => {
      expect(isValidHashtag('#plasticandmetalliccapproducts')).toBe(false);
      expect(isValidHashtag('#beautymakeupproducts')).toBe(false);
      expect(isValidHashtag('#newproducts')).toBe(false);
      expect(isValidHashtag('#productfinds')).toBe(true); // 'product' without 'products' is ok
    });

    it('rejects standalone material hashtags', () => {
      expect(isValidHashtag('#plastic')).toBe(false);
      expect(isValidHashtag('#metallic')).toBe(false);
      expect(isValidHashtag('#polyester')).toBe(false);
      expect(isValidHashtag('#stainlesssteel')).toBe(false);
    });
  });

  describe('Marketplace Name Exclusion in Brand and Queries', () => {
    it('never includes retailer or marketplace name in queries if passed as brand', () => {
      const marketplaceBrands = ['Amazon', 'Flipkart', 'Myntra', 'Walmart', 'eBay', 'Etsy', 'Amazon India'];

      for (const mb of marketplaceBrands) {
        const queries = generator.generate(sampleAnalysis, mb);

        // Hashtags must not contain marketplace name
        const lowerMb = mb.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const tag of queries.instagram.hashtags) {
          expect(tag.toLowerCase()).not.toContain(lowerMb);
        }

        // Keywords must not contain marketplace name
        for (const kw of queries.instagram.keywords) {
          expect(kw.toLowerCase()).not.toContain(mb.toLowerCase());
        }

        // Meta search terms must not contain marketplace name
        for (const term of queries.meta.searchTerms) {
          expect(term.toLowerCase()).not.toContain(mb.toLowerCase());
        }

        // TikTok search terms must not contain marketplace name
        for (const term of queries.tiktok.searchTerms) {
          expect(term.toLowerCase()).not.toContain(mb.toLowerCase());
        }

        // Expansion tiers must not contain marketplace name
        for (const tier of queries.expansionTiers.tier1) {
          expect(tier.toLowerCase()).not.toContain(mb.toLowerCase());
        }
      }
    });

    it('includes real brand in queries and hashtags', () => {
      const queries = generator.generate(sampleAnalysis, 'Fenty Beauty');
      expect(queries.instagram.hashtags).toContain('#fentybeauty');
      expect(queries.instagram.keywords).toContain('Fenty Beauty Wooden Miniature Dollhouse');
      expect(queries.meta.searchTerms).toContain('Fenty Beauty');
      expect(queries.expansionTiers.tier1).toContain('Fenty Beauty Wooden Miniature Dollhouse');
    });

    it('rejects bare single-word or numeric brand terms like 247 and combines brand + product type for Meta search', () => {
      const fashionAnalysis: ProductAnalysis = {
        ...sampleAnalysis,
        productType: 'Oversized Tank Top',
        category: 'Apparel & Accessories / Clothing / Tops',
      };

      // Numeric brand "247"
      const numQueries = generator.generate(fashionAnalysis, '247');
      expect(numQueries.meta.searchTerms).not.toContain('247');
      expect(numQueries.meta.searchTerms.every((t) => t.split(' ').length >= 2 && t.split(' ').length <= 4)).toBe(true);

      // Single-word brand "Represent"
      const repQueries = generator.generate(fashionAnalysis, 'Represent');
      expect(repQueries.meta.searchTerms).not.toContain('Represent');
      expect(repQueries.meta.searchTerms).toContain('Represent Oversized Tank Top');
      expect(repQueries.meta.searchTerms).toContain('Represent Oversized Tank');
      for (const term of repQueries.meta.searchTerms) {
        const wordCount = term.split(' ').length;
        expect(wordCount).toBeGreaterThanOrEqual(2);
        expect(wordCount).toBeLessThanOrEqual(4);
      }
    });
  });
});
