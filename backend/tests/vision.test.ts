import { describe, it, expect } from 'vitest';
import { MockVisionProvider } from '../src/providers/vision/mock.provider';
import { productAnalysisSchema } from '../src/providers/vision/types';

describe('Image Brain Vision Provider & Schema Validation', () => {
  const mockProvider = new MockVisionProvider();

  it('validates correct product analysis structured JSON using Zod', () => {
    const validJson = {
      productType: 'Wooden Miniature Dollhouse',
      category: 'Toys & Games / Pretend Play',
      dominantColour: 'Rose Pink',
      secondaryColours: ['Pastel Mint', 'Soft Coral'],
      printsAndGraphics: [],
      logos: ['PastelPlay'],
      visibleText: ['Ages 3+'],
      material: 'Solid Beech Wood',
      shape: 'Three-storey cottage with pitched roof',
      distinguishingAttributes: ['Non-toxic glaze', 'Includes furniture set'],
      attributeConfidence: {
        productType: 0.95,
        dominantColour: 0.92,
        category: 0.94,
        material: 0.9,
      },
      isTextDerived: false,
    };

    const parsed = productAnalysisSchema.parse(validJson);
    expect(parsed.productType).toBe('Wooden Miniature Dollhouse');
    expect(parsed.dominantColour).toBe('Rose Pink');
    expect(parsed.isTextDerived).toBe(false);
  });

  it('rejects malformed schema and triggers validation error for missing required fields', () => {
    const brokenJson = {
      category: 'Toys',
      dominantColour: 'Pink',
      // Missing required productType and material
    };

    const result = productAnalysisSchema.safeParse(brokenJson);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain('productType');
      expect(issuePaths).toContain('material');
    }
  });

  it('demonstrates repair logic: repaired JSON successfully passes schema validation after repair attempt', () => {
    // 1. Initial flawed response missing fields
    const flawedResponse = {
      category: 'Electronics',
      dominantColour: 'Black',
    };
    const firstAttempt = productAnalysisSchema.safeParse(flawedResponse);
    expect(firstAttempt.success).toBe(false);

    // 2. Simulated repair feedback prompt repair
    const repairedResponse = {
      ...flawedResponse,
      productType: 'Wireless Headphones',
      material: 'Aluminium and Leather',
      shape: 'Over-ear oval headphones with adjustable headband',
      distinguishingAttributes: ['Active Noise Cancellation'],
      attributeConfidence: { productType: 0.9 },
      isTextDerived: true,
    };

    const repairAttempt = productAnalysisSchema.safeParse(repairedResponse);
    expect(repairAttempt.success).toBe(true);
    if (repairAttempt.success) {
      expect(repairAttempt.data.productType).toBe('Wireless Headphones');
      expect(repairAttempt.data.material).toBe('Aluminium and Leather');
    }
  });

  it('MockVisionProvider produces rich structured attributes with image buffer', async () => {
    const fakeImageBuffer = Buffer.from('FAKE_IMAGE_BYTES_12345');

    const result = await mockProvider.analyze({
      title: 'Wooden Dollhouse Playset',
      description: 'Handcrafted miniature wooden dollhouse',
      imageBuffer: fakeImageBuffer,
    });

    expect(result.productType).toContain('Dollhouse');
    expect(result.category).toContain('Toys & Games');
    expect(result.material).toContain('Wood');
    expect(result.isTextDerived).toBe(false);
    expect(result.attributeConfidence.productType).toBeGreaterThan(0.8);
  });

  it('MockVisionProvider flags keyword-only searches as text-derived', async () => {
    const result = await mockProvider.analyze({
      title: 'Ergonomic Commuter Backpack',
      description: 'Water-resistant roll-top backpack',
    });

    expect(result.productType).toContain('Backpack');
    expect(result.isTextDerived).toBe(true);
  });
});
