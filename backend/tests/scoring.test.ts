import { describe, it, expect } from 'vitest';
import { ScoringService, cosineSimilarity } from '../src/services/scoring.service';
import { ProductAnalysis } from '../src/providers/vision/types';
import { CandidateVideo } from '../src/types';

describe('Hybrid Scoring Engine (Phase 4)', () => {
  const mockProductAnalysis: ProductAnalysis = {
    productType: 'Lip Gloss',
    category: 'Beauty & Personal Care / Makeup',
    dominantColour: 'Rose Shimmer',
    secondaryColours: ['Gold', 'Pink'],
    printsAndGraphics: [],
    logos: ['Fenty Beauty'],
    visibleText: ['FENTY BEAUTY', 'Gloss Bomb'],
    material: 'Gloss Liquid',
    shape: 'Octagonal Glass Tube with Wand',
    distinguishingAttributes: ['Universal Lip Luminizer', 'High shine finish'],
    attributeConfidence: {
      productType: 0.98,
      dominantColour: 0.95,
      category: 0.92,
      material: 0.88,
      shape: 0.90,
    },
    isTextDerived: false,
    isMock: true,
  };

  const productInfo = {
    title: 'Fenty Beauty Gloss Bomb Universal Lip Luminizer',
    brand: 'Fenty Beauty',
    analysis: mockProductAnalysis,
  };

  it('computes mathematical cosine similarity accurately', () => {
    // Identical vectors -> 1.0
    const vecA = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecA)).toBeCloseTo(1.0, 5);

    // Orthogonal vectors -> 0.0
    const vecX = [1, 0, 0];
    const vecY = [0, 1, 0];
    expect(cosineSimilarity(vecX, vecY)).toBeCloseTo(0.0, 5);

    // Opposite vectors -> -1.0
    const vecOpp = [-1, -2, -3];
    expect(cosineSimilarity(vecA, vecOpp)).toBeCloseTo(-1.0, 5);
  });

  it('calculates hybrid score using default 0.40 embedding and 0.60 rubric weights', async () => {
    const scorer = new ScoringService({
      mode: 'mock',
      embeddingWeight: 0.4,
      rubricWeight: 0.6,
      minMatchThreshold: 60,
    });

    const candidates: CandidateVideo[] = [
      {
        id: 'cand-1',
        platform: 'instagram',
        platformVideoId: '101',
        canonicalUrl: 'https://instagram.com/reel/101',
        caption: 'Reviewing the gorgeous Fenty Beauty Gloss Bomb in Rose Shimmer! Best lip gloss formula.',
        author: '@fentyfan',
        isMock: true,
      },
      {
        id: 'cand-2',
        platform: 'meta',
        platformVideoId: '202',
        canonicalUrl: 'https://facebook.com/ad/202',
        caption: 'Huge clearance sale on automotive brake pads and tires! Order today.',
        author: 'AutoParts Store',
        isMock: true,
      },
    ];

    const results = await scorer.scoreCandidates(productInfo, candidates);

    expect(results).toHaveLength(2);

    const goodMatch = results[0];
    const badMatch = results[1];

    // High matching product should score well above 60
    expect(goodMatch.matchScore).toBeGreaterThanOrEqual(60);
    expect(goodMatch.belowThreshold).toBe(false);
    expect(goodMatch.scoreBreakdown.attributeVerdicts?.productType).toBe('match');
    expect(goodMatch.scoreBreakdown.attributeVerdicts?.brand).toBe('match');
    expect(goodMatch.scoreBreakdown.bonuses).toBe(10); // Logo / brand bonus
    expect(goodMatch.explanation).toContain('Fenty Beauty');

    // Unrelated product should score well below 60 and be flagged belowThreshold
    expect(badMatch.matchScore).toBeLessThan(60);
    expect(badMatch.belowThreshold).toBe(true);
    expect(badMatch.scoreBreakdown.attributeVerdicts?.relevance).toBe('mismatch');
    expect(badMatch.scoreBreakdown.penalties).toBe(20); // Mismatch penalty
  });

  it('clamps final match score strictly between 0 and 100', async () => {
    const scorer = new ScoringService({
      mode: 'mock',
      embeddingWeight: 0.4,
      rubricWeight: 0.6,
      minMatchThreshold: 60,
    });

    const candidates: CandidateVideo[] = [
      {
        id: 'cand-max',
        platform: 'instagram',
        platformVideoId: 'max',
        canonicalUrl: 'https://instagram.com/reel/max',
        caption: 'Fenty Beauty Gloss Bomb Universal Lip Luminizer Rose Shimmer lip gloss official authentic swatch',
        isMock: true,
      },
    ];

    const [result] = await scorer.scoreCandidates(productInfo, candidates);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(result.matchScore).toBeGreaterThanOrEqual(0);
    expect(result.scoreBreakdown.finalScore).toBe(result.matchScore);
  });
});
