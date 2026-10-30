import { logger } from '../utils/logger';
import { safeFetch } from '../utils/ssrf';
import { ProductAnalysis } from '../providers/vision/types';
import { CandidateVideo, ScoreBreakdown } from '../types';

export interface ScoredCandidate {
  candidate: CandidateVideo;
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
  explanation: string;
  belowThreshold: boolean;
}

export interface ScoringOptions {
  embeddingWeight?: number; // default 0.40
  rubricWeight?: number; // default 0.60
  minMatchThreshold?: number; // default 60
  mode?: 'live' | 'mock';
  apiKey?: string;
  embeddingModel?: string;
}

/**
 * Computes cosine similarity between two vector arrays
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class ScoringService {
  private embeddingWeight: number;
  private rubricWeight: number;
  private minMatchThreshold: number;
  private mode: 'live' | 'mock';
  private apiKey?: string;
  private embeddingModel: string;

  constructor(options?: ScoringOptions) {
    this.embeddingWeight = options?.embeddingWeight ?? Number(process.env.EMBEDDING_WEIGHT || 0.4);
    this.rubricWeight = options?.rubricWeight ?? Number(process.env.RUBRIC_WEIGHT || 0.6);
    this.minMatchThreshold = options?.minMatchThreshold ?? Number(process.env.MIN_MATCH_THRESHOLD || 60);
    this.mode = options?.mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    this.embeddingModel = options?.embeddingModel || 'models/gemini-embedding-001';
  }

  /**
   * Scores a collection of candidate videos against resolved product attributes
   */
  async scoreCandidates(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[]
  ): Promise<ScoredCandidate[]> {
    if (candidates.length === 0) return [];

    logger.info(
      { candidateCount: candidates.length, mode: this.mode, threshold: this.minMatchThreshold },
      'Starting candidate video scoring'
    );

    if (this.mode === 'mock' || !this.apiKey) {
      return this.scoreMock(product, candidates);
    }

    try {
      return await this.scoreLive(product, candidates);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Live scoring encountered error, falling back to heuristic scoring');
      return this.scoreMock(product, candidates);
    }
  }

  /**
   * Fetches vector embedding from Gemini API for text
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.apiKey || !text.trim()) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          content: { parts: [{ text: text.slice(0, 2048) }] },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.embedding?.values && Array.isArray(data.embedding.values)) {
          return data.embedding.values;
        }
      }
      return null;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to generate Gemini text embedding');
      return null;
    }
  }

  /**
   * Live scoring using Gemini embeddings and structured VLM rubric judging
   */
  private async scoreLive(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[]
  ): Promise<ScoredCandidate[]> {
    // 1. Build product semantic profile text
    const productProfile = [
      product.title,
      product.brand ? `Brand: ${product.brand}` : '',
      `Type: ${product.analysis.productType}`,
      `Category: ${product.analysis.category}`,
      `Dominant Color: ${product.analysis.dominantColour}`,
      product.analysis.distinguishingAttributes?.length
        ? `Features: ${product.analysis.distinguishingAttributes.join(', ')}`
        : '',
      product.analysis.logos?.length ? `Logos: ${product.analysis.logos.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('. ');

    // 2. Fetch product embedding
    const productVec = await this.getEmbedding(productProfile);

    // 3. Batch candidate rubric judgments in chunks of 10 for performance and token efficiency
    const chunkSize = 10;
    const scoredList: ScoredCandidate[] = [];

    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      const chunkResults = await this.scoreLiveChunk(product, chunk, productVec);
      scoredList.push(...chunkResults);
    }

    return scoredList;
  }

  /**
   * Score a batch chunk of candidates
   */
  private async scoreLiveChunk(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[],
    productVec: number[] | null
  ): Promise<ScoredCandidate[]> {
    // Collect candidate text descriptions for embeddings
    const candidateVectors = await Promise.all(
      candidates.map(async (c) => {
        const text = `${c.caption || ''} ${c.author || ''}`.trim();
        return text ? await this.getEmbedding(text) : null;
      })
    );

    // Prompt Gemini for structured rubric judgment on the chunk
    const prompt = this.buildRubricPrompt(product, candidates);
    let rubricJudgments: Array<{
      index: number;
      rubricScore: number;
      verdicts: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'>;
      bonuses: number;
      penalties: number;
      explanation: string;
    }> = [];

    try {
      rubricJudgments = await this.callGeminiRubric(prompt, candidates.length);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed Gemini rubric chunk call, falling back to heuristic for chunk');
    }

    const judgmentsMap = new Map<number, (typeof rubricJudgments)[0]>();
    rubricJudgments.forEach((j) => judgmentsMap.set(j.index, j));

    return candidates.map((cand, idx) => {
      // 1. Calculate embedding similarity score (0 - 100)
      let embeddingScore = 50; // default baseline
      const candVec = candidateVectors[idx];
      if (productVec && candVec) {
        const sim = cosineSimilarity(productVec, candVec);
        // Cosine sim is typically in [-1, 1], scale to [0, 100]
        embeddingScore = Math.max(0, Math.min(100, Math.round(sim * 100)));
      } else {
        // Fallback token-based similarity
        embeddingScore = this.computeTokenSimilarity(product, cand);
      }

      // Store embedding vector on candidate for persistence
      if (candVec) {
        cand.embedding = candVec;
      }

      // 2. Extract rubric score and verdicts
      const judgment = judgmentsMap.get(idx);
      let rubricScore = 50;
      let attributeVerdicts: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'> = {
        productType: 'partial',
        color: 'partial',
        brand: 'partial',
        relevance: 'partial',
      };
      let bonuses = 0;
      let penalties = 0;
      let explanation = 'Candidate video evaluated against product features.';

      if (judgment) {
        rubricScore = Math.max(0, Math.min(100, judgment.rubricScore));
        attributeVerdicts = judgment.verdicts || attributeVerdicts;
        bonuses = judgment.bonuses || 0;
        penalties = judgment.penalties || 0;
        explanation = judgment.explanation || explanation;
      } else {
        // Fallback rule evaluation
        const fallback = this.evaluateFallbackRubric(product, cand);
        rubricScore = fallback.rubricScore;
        attributeVerdicts = fallback.verdicts;
        bonuses = fallback.bonuses;
        penalties = fallback.penalties;
        explanation = fallback.explanation;
      }

      // 3. Compute final weighted hybrid score:
      // Score = (w_embed * S_embed) + (w_rubric * S_rubric) + B_logo - P_novis
      const rawScore =
        this.embeddingWeight * embeddingScore +
        this.rubricWeight * rubricScore +
        bonuses -
        penalties;

      const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));
      const belowThreshold = finalScore < this.minMatchThreshold;

      const scoreBreakdown: ScoreBreakdown = {
        embeddingScore,
        rubricScore,
        finalScore,
        attributeVerdicts,
        bonuses,
        penalties,
      };

      return {
        candidate: cand,
        matchScore: finalScore,
        scoreBreakdown,
        explanation,
        belowThreshold,
      };
    });
  }

  private buildRubricPrompt(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[]
  ): string {
    const candidateList = candidates
      .map(
        (c, idx) =>
          `[Item ${idx}]: Platform: ${c.platform}, Author: ${c.author || 'unknown'}, Caption: "${(c.caption || '').slice(0, 300)}"`
      )
      .join('\n');

    return `You are an expert product similarity and relevance scoring judge.
Evaluate each candidate social media video against the target product.

TARGET PRODUCT:
- Title: "${product.title}"
- Brand: "${product.brand || 'Unbranded'}"
- Product Type: "${product.analysis.productType}"
- Category: "${product.analysis.category}"
- Dominant Color: "${product.analysis.dominantColour}"
- Distinct Attributes: "${(product.analysis.distinguishingAttributes || []).join(', ')}"

EVALUATION RUBRIC:
For each item, score on a 0-100 scale based on:
1. Product Type / Form Match (0-40 pts): Does the video showcase the exact same product type?
2. Color & Visual Style Match (0-25 pts): Does it match the color, shade, or aesthetics?
3. Brand / Logo Match (0-20 pts): Does it showcase the target brand or official product?
4. Category Relevance (0-15 pts): Is the video contextual to this e-commerce product category?

Bonuses / Penalties:
- bonuses: +10 if target brand or product name is explicitly featured or confirmed.
- penalties: -20 if caption or content indicates a completely unrelated product, spam, or no product visible.

Return a JSON array containing an evaluation object for each Item (from 0 to ${candidates.length - 1}):
[
  {
    "index": 0,
    "rubricScore": 85,
    "verdicts": {
      "productType": "match" | "partial" | "mismatch" | "not_visible",
      "color": "match" | "partial" | "mismatch" | "not_visible",
      "brand": "match" | "partial" | "mismatch" | "not_visible",
      "relevance": "match" | "partial" | "mismatch" | "not_visible"
    },
    "bonuses": 10,
    "penalties": 0,
    "explanation": "Clear 1-2 sentence human explanation of why it matches or mismatches."
  }
]
Output strictly raw valid JSON array, no markdown backticks.`;
  }

  private async callGeminiRubric(
    prompt: string,
    expectedCount: number
  ): Promise<any[]> {
    if (!this.apiKey) return [];

    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Gemini rubric generation failed with status ${res.status}`);
    }

    const data = (await res.json()) as any;
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  }

  /**
   * Deterministic mock scoring for unit tests and offline mock mode
   */
  private scoreMock(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[]
  ): ScoredCandidate[] {
    return candidates.map((cand) => {
      const fallback = this.evaluateFallbackRubric(product, cand);
      const tokenSim = this.computeTokenSimilarity(product, cand);

      const rawScore =
        this.embeddingWeight * tokenSim +
        this.rubricWeight * fallback.rubricScore +
        fallback.bonuses -
        fallback.penalties;

      const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));
      const belowThreshold = finalScore < this.minMatchThreshold;

      return {
        candidate: cand,
        matchScore: finalScore,
        scoreBreakdown: {
          embeddingScore: tokenSim,
          rubricScore: fallback.rubricScore,
          finalScore,
          attributeVerdicts: fallback.verdicts,
          bonuses: fallback.bonuses,
          penalties: fallback.penalties,
        },
        explanation: fallback.explanation,
        belowThreshold,
      };
    });
  }

  /**
   * Fallback rule-based rubric evaluation based on text token overlap
   */
  private evaluateFallbackRubric(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    cand: CandidateVideo
  ): {
    rubricScore: number;
    verdicts: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'>;
    bonuses: number;
    penalties: number;
    explanation: string;
  } {
    const text = `${cand.caption || ''} ${cand.author || ''}`.toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    const pType = (product.analysis.productType || '').toLowerCase();
    const color = (product.analysis.dominantColour || '').toLowerCase();

    let brandMatch: 'match' | 'partial' | 'mismatch' | 'not_visible' = 'mismatch';
    if (brand && text.includes(brand)) {
      brandMatch = 'match';
    } else if (brand) {
      const parts = brand.split(/\s+/).filter((p) => p.length > 2);
      if (parts.some((p) => text.includes(p))) brandMatch = 'partial';
    } else {
      brandMatch = 'not_visible';
    }

    let pTypeMatch: 'match' | 'partial' | 'mismatch' | 'not_visible' = 'mismatch';
    const typeWords = pType.split(/\s+/).filter((w) => w.length > 3);
    const matchedTypeWords = typeWords.filter((w) => text.includes(w));
    if (typeWords.length > 0 && matchedTypeWords.length === typeWords.length) {
      pTypeMatch = 'match';
    } else if (matchedTypeWords.length > 0) {
      pTypeMatch = 'partial';
    }

    let colorMatch: 'match' | 'partial' | 'mismatch' | 'not_visible' = 'not_visible';
    if (color && text.includes(color)) {
      colorMatch = 'match';
    } else if (color) {
      const colorWords = color.split(/\s+/).filter((w) => w.length > 2);
      if (colorWords.some((w) => text.includes(w))) {
        colorMatch = 'partial';
      }
    }

    let relevance: 'match' | 'partial' | 'mismatch' | 'not_visible' = 'partial';
    if (brandMatch === 'match' || pTypeMatch === 'match') {
      relevance = 'match';
    } else if (brandMatch === 'mismatch' && pTypeMatch === 'mismatch') {
      relevance = 'mismatch';
    }

    let rubricScore = 0;
    // Type match: up to 40
    rubricScore += pTypeMatch === 'match' ? 40 : pTypeMatch === 'partial' ? 25 : 5;
    // Color match: up to 25
    rubricScore += colorMatch === 'match' ? 25 : colorMatch === 'partial' ? 15 : 10;
    // Brand match: up to 20
    rubricScore += brandMatch === 'match' ? 20 : brandMatch === 'partial' ? 10 : 0;
    // Relevance: up to 15
    rubricScore += relevance === 'match' ? 15 : relevance === 'partial' ? 8 : 0;

    let bonuses = 0;
    let penalties = 0;
    if (brandMatch === 'match') bonuses += 10;
    if (relevance === 'mismatch') penalties += 20;

    const explanation =
      brandMatch === 'match' && pTypeMatch === 'match'
        ? `Video directly features ${product.brand || 'product'} with matching product type and strong brand presence.`
        : brandMatch === 'match'
        ? `Video references ${product.brand} brand but shows different or related style variations.`
        : pTypeMatch === 'match'
        ? `Video showcases matching ${product.analysis.productType} style, but does not explicitly confirm brand.`
        : `Video caption or ad copy exhibits limited overlap with target product attributes.`;

    return {
      rubricScore: Math.min(100, rubricScore),
      verdicts: {
        productType: pTypeMatch,
        color: colorMatch,
        brand: brandMatch,
        relevance,
      },
      bonuses,
      penalties,
      explanation,
    };
  }

  private computeTokenSimilarity(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    cand: CandidateVideo
  ): number {
    const textA = [
      product.title,
      product.brand,
      product.analysis.productType,
      product.analysis.dominantColour,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const textB = `${cand.caption || ''} ${cand.author || ''}`.toLowerCase();

    const tokensA = new Set(textA.split(/\s+/).filter((w) => w.length > 2));
    const tokensB = new Set(textB.split(/\s+/).filter((w) => w.length > 2));

    if (tokensA.size === 0 || tokensB.size === 0) return 40;

    let matchCount = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) matchCount++;
    }

    const overlapRatio = matchCount / Math.min(tokensA.size, 10);
    return Math.max(20, Math.min(100, Math.round(overlapRatio * 100)));
  }
}
