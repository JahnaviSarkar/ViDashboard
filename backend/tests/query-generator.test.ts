import { describe, it, expect } from 'vitest';
import { QueryGeneratorService } from '../src/services/query-generator.service';
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
});
