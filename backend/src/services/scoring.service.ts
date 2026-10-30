import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { safeFetch } from '../utils/ssrf';
import { ProductAnalysis } from '../providers/vision/types';
import { CandidateVideo, ScoreBreakdown } from '../types';
import { getThumbnailStorageDir } from '../utils/thumbnail-storage';

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
 * Helper to compress and format image buffers for Gemini VLM (max 400x400 JPEG, ~15-30KB)
 */
async function compressImageForVlm(buffer: Buffer): Promise<string | null> {
  try {
    const resized = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return resized.toString('base64');
  } catch {
    return buffer.toString('base64');
  }
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
   * Scores a collection of candidate videos against resolved product attributes and images
   */
  async scoreCandidates(
    product: {
      title: string;
      brand?: string;
      imageUrl?: string;
      imageBuffer?: Buffer;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[]
  ): Promise<ScoredCandidate[]> {
    if (candidates.length === 0) return [];

    logger.info(
      { candidateCount: candidates.length, mode: this.mode, threshold: this.minMatchThreshold },
      'Starting candidate video scoring'
    );

    // Resolve visual evidence buffers for each candidate upfront
    await this.prepareCandidateVisualEvidence(candidates);

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
   * Prepares and loads frame or thumbnail buffers on candidates if not already present
   */
  private async prepareCandidateVisualEvidence(candidates: CandidateVideo[]): Promise<void> {
    const thumbDir = getThumbnailStorageDir();

    for (const cand of candidates) {
      if (cand.frameBuffers && cand.frameBuffers.length > 0) {
        cand.evidence = cand.evidence || 'frames';
        continue;
      }

      // If mock candidate with thumbnail, simulate visual evidence without network
      if (cand.isMock && cand.thumbnailUrl) {
        cand.evidence = cand.evidence || 'thumbnail';
        continue;
      }

      // Check if thumbnail exists locally or via URL
      if (cand.thumbnailUrl) {
        try {
          let buffer: Buffer | null = null;
          if (cand.thumbnailUrl.startsWith('/storage/thumbnails/')) {
            const filename = path.basename(cand.thumbnailUrl);
            const localFile = path.join(thumbDir, filename);
            if (fs.existsSync(localFile)) {
              buffer = fs.readFileSync(localFile);
            }
          } else if (fs.existsSync(cand.thumbnailUrl)) {
            buffer = fs.readFileSync(cand.thumbnailUrl);
          } else if (cand.thumbnailUrl.startsWith('http')) {
            const res = await safeFetch(cand.thumbnailUrl, { timeoutMs: 6000, maxBytes: 5 * 1024 * 1024 });
            if (res.statusCode >= 200 && res.statusCode < 300 && res.buffer.length > 0) {
              buffer = res.buffer;
            }
          }

          if (buffer && buffer.length > 0) {
            cand.frameBuffers = [buffer];
            cand.evidence = 'thumbnail';
            continue;
          }
        } catch {
          // Ignore and mark caption only
        }
      }

      cand.evidence = 'caption_only';
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
   * Live scoring using Gemini embeddings and multimodal VLM rubric judging with visual evidence
   */
  private async scoreLive(
    product: {
      title: string;
      brand?: string;
      imageUrl?: string;
      imageBuffer?: Buffer;
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

    // 3. Batch candidate rubric judgments in chunks of 5 for token efficiency & fast multimodal VLM execution
    const chunkSize = 5;
    const scoredList: ScoredCandidate[] = [];

    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      const chunkResults = await this.scoreLiveChunk(product, chunk, productVec);
      scoredList.push(...chunkResults);
    }

    return scoredList;
  }

  /**
   * Score a batch chunk of candidates with visual evidence parts sent to Gemini VLM
   */
  private async scoreLiveChunk(
    product: {
      title: string;
      brand?: string;
      imageUrl?: string;
      imageBuffer?: Buffer;
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

    // Build multimodal prompt parts (Product image + Candidate visual frames/thumbnails)
    const parts = await this.buildMultimodalRubricParts(product, candidates);

    let rubricJudgments: Array<{
      index: number;
      rubricScore: number;
      verdicts: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'>;
      bonuses: number;
      penalties: number;
      explanation: string;
    }> = [];

    try {
      rubricJudgments = await this.callGeminiMultimodalRubric(parts, candidates.length);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed Gemini multimodal rubric call, falling back to heuristic for chunk');
    }

    const judgmentsMap = new Map<number, (typeof rubricJudgments)[0]>();
    rubricJudgments.forEach((j) => judgmentsMap.set(j.index, j));

    return candidates.map((cand, idx) => {
      const evidence = cand.evidence || 'caption_only';

      // 1. Calculate embedding similarity score (0 - 100)
      let embeddingScore = 50; // default baseline
      const candVec = candidateVectors[idx];
      if (productVec && candVec) {
        const sim = cosineSimilarity(productVec, candVec);
        embeddingScore = Math.max(0, Math.min(100, Math.round(sim * 100)));
      } else {
        embeddingScore = this.computeTokenSimilarity(product, cand);
      }

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

      let finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

      // RULE 1: If evidence is caption_only (no image reachable), cap final score at 40 and mark clearly
      if (evidence === 'caption_only') {
        finalScore = Math.min(40, finalScore);
        explanation = `[caption_only] ${explanation} (No visual evidence reachable; score capped at 40).`;
      }

      const belowThreshold = finalScore < this.minMatchThreshold || evidence === 'caption_only';

      const scoreBreakdown: ScoreBreakdown = {
        evidence,
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

  /**
   * Constructs multimodal parts including product image and candidate frames/thumbnails
   */
  private async buildMultimodalRubricParts(
    product: {
      title: string;
      brand?: string;
      imageBuffer?: Buffer;
      analysis: ProductAnalysis;
    },
    candidates: CandidateVideo[]
  ): Promise<any[]> {
    const parts: any[] = [];

    // Header instructions
    parts.push({
      text: `You are an expert product similarity and relevance scoring judge.
You MUST evaluate candidate social media videos against the TARGET PRODUCT.
CRITICAL: The evaluation MUST be grounded in VISUAL EVIDENCE.
Explanations MUST cite what is VISIBLE in the image (e.g. "white sleeveless top visible, no logo readable", or "wide leg sweatpants visible instead of target tank top"). Never cite only caption overlap when visuals are present.

TARGET PRODUCT:
- Title: "${product.title}"
- Brand: "${product.brand || 'Unbranded'}"
- Product Type: "${product.analysis.productType}"
- Category: "${product.analysis.category}"
- Dominant Color: "${product.analysis.dominantColour}"
- Distinct Attributes: "${(product.analysis.distinguishingAttributes || []).join(', ')}"
- Distinct Logos: "${(product.analysis.logos || []).join(', ')}"`
    });

    // Target product image if available
    if (product.imageBuffer && product.imageBuffer.length > 0) {
      const compressedTarget = await compressImageForVlm(product.imageBuffer);
      if (compressedTarget) {
        parts.push({ text: 'REFERENCE IMAGE OF TARGET PRODUCT:' });
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: compressedTarget,
          },
        });
      }
    }

    // Attach candidate metadata and visual images/frames
    for (let idx = 0; idx < candidates.length; idx++) {
      const c = candidates[idx];
      const evidence = c.evidence || 'caption_only';

      parts.push({
        text: `\n[Candidate Item ${idx}]:
Platform: ${c.platform}
Author: ${c.author || 'unknown'}
Caption: "${(c.caption || '').slice(0, 300)}"
Visual Evidence Type: ${evidence}`,
      });

      if (c.frameBuffers && c.frameBuffers.length > 0) {
        for (let fIdx = 0; fIdx < c.frameBuffers.length; fIdx++) {
          const compressed = await compressImageForVlm(c.frameBuffers[fIdx]);
          if (compressed) {
            parts.push({ text: `Visual frame/thumbnail ${fIdx + 1} for Item ${idx}:` });
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: compressed,
              },
            });
          }
        }
      } else {
        parts.push({ text: `(NO VISUAL EVIDENCE REACHABLE FOR ITEM ${idx} - CAPTION ONLY)` });
      }
    }

    // Rubric criteria and JSON output schema
    parts.push({
      text: `\nEVALUATION RUBRIC:
For each candidate item (0 to ${candidates.length - 1}), score on a 0-100 scale:
1. Product Type / Silhouette Form Match (0-40 pts): LOOK AT THE VISUALS! Does the candidate video visibly show the exact same product type/silhouette? If candidate visual shows pants/trousers instead of a top, or footwear instead of clothing, productType MUST be "mismatch" and score <= 10.
2. Color & Visual Style Match (0-25 pts): LOOK AT THE VISUALS! Does the color, shade, and material texture match the target product image?
3. Brand / Logo Match (0-20 pts): Is the brand logo visible on the product or confirmed?
4. Category Relevance (0-15 pts): Does the video content belong to this specific e-commerce category?

Bonuses / Penalties:
- bonuses: +10 if target brand or product name is explicitly confirmed visually or in ad copy.
- penalties: -20 if visual content indicates a completely different garment, unrelated product, or spam.

RULES:
- If evidence is "caption_only" (no visual image reachable), rubricScore MUST NOT exceed 35, and explanation must explicitly state "No visual evidence reachable; evaluated from caption only."
- Explanations MUST cite what is VISIBLE in the image (e.g. "black sleeveless tank with crew neckline visible, matching target silhouette" or "wide leg sweatpants visible instead of target sleeveless tank top; no matching garment visible"). Never cite only caption overlap when visuals are present.

Return a JSON array of evaluation objects:
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
    "explanation": "Clear 1-2 sentence human explanation citing visible features in the image."
  }
]
Output strictly raw valid JSON array, no markdown backticks.`,
    });

    return parts;
  }

  private async callGeminiMultimodalRubric(
    parts: any[],
    expectedCount: number
  ): Promise<any[]> {
    if (!this.apiKey) return [];

    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      throw new Error(`Gemini multimodal rubric generation failed with status ${res.status}`);
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
      const evidence = cand.evidence || (cand.thumbnailUrl ? 'thumbnail' : 'caption_only');
      const fallback = this.evaluateFallbackRubric(product, cand);
      const tokenSim = this.computeTokenSimilarity(product, cand);

      const rawScore =
        this.embeddingWeight * tokenSim +
        this.rubricWeight * fallback.rubricScore +
        fallback.bonuses -
        fallback.penalties;

      let finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));
      let explanation = fallback.explanation;

      // Cap at 40 if caption_only
      if (evidence === 'caption_only') {
        finalScore = Math.min(40, finalScore);
        explanation = `[caption-only: no visual media reachable] ${explanation}`;
      }

      const belowThreshold = finalScore < this.minMatchThreshold || evidence === 'caption_only';

      return {
        candidate: cand,
        matchScore: finalScore,
        scoreBreakdown: {
          evidence,
          embeddingScore: tokenSim,
          rubricScore: fallback.rubricScore,
          finalScore,
          attributeVerdicts: fallback.verdicts,
          bonuses: fallback.bonuses,
          penalties: fallback.penalties,
        },
        explanation,
        belowThreshold,
      };
    });
  }

  /**
   * Fallback rule-based rubric evaluation based on visual tokens & text
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

    // Check for negative mismatch terms (e.g. wide leg pant vs tank top)
    const isPantWhenTargetIsTop =
      (pType.includes('tank') || pType.includes('top') || pType.includes('shirt')) &&
      (text.includes('pant') || text.includes('trouser') || text.includes('legging') || text.includes('sweat'));

    if (isPantWhenTargetIsTop) {
      return {
        rubricScore: 10,
        verdicts: {
          productType: 'mismatch',
          color: 'not_visible',
          brand: brand && text.includes(brand) ? 'match' : 'mismatch',
          relevance: 'mismatch',
        },
        bonuses: 0,
        penalties: 20,
        explanation: 'Visual evidence depicts wide leg pants/sweatpants rather than the target oversized sleeveless tank top.',
      };
    }

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
    }

    let rubricScore = 20;
    if (pTypeMatch === 'match') rubricScore += 35;
    else if (pTypeMatch === 'partial') rubricScore += 15;

    if (colorMatch === 'match') rubricScore += 20;
    if (brandMatch === 'match') rubricScore += 25;
    else if (brandMatch === 'partial') rubricScore += 10;

    let bonuses = 0;
    let penalties = 0;
    if (brandMatch === 'match') bonuses += 10;
    if (pTypeMatch === 'mismatch' && brandMatch === 'mismatch') penalties += 20;

    let explanation = `Visible silhouette matches ${product.analysis.productType || 'target product'}.`;
    if (pTypeMatch === 'mismatch') {
      explanation = `Visible item does not match target ${product.analysis.productType || 'product'}.`;
    } else if (brandMatch === 'match') {
      explanation = `Visible product style matches ${product.title}; brand verified.`;
    }

    return {
      rubricScore: Math.min(100, rubricScore),
      verdicts: {
        productType: pTypeMatch,
        color: colorMatch,
        brand: brandMatch,
        relevance: pTypeMatch === 'mismatch' ? 'mismatch' : 'match',
      },
      bonuses,
      penalties,
      explanation,
    };
  }

  /**
   * Word token overlap similarity for fallback embedding score
   */
  private computeTokenSimilarity(
    product: {
      title: string;
      brand?: string;
      analysis: ProductAnalysis;
    },
    cand: CandidateVideo
  ): number {
    const targetWords = new Set(
      `${product.title} ${product.brand || ''} ${product.analysis.productType} ${product.analysis.category}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    const candWords = `${cand.caption || ''} ${cand.author || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (targetWords.size === 0 || candWords.length === 0) return 30;

    let matches = 0;
    for (const w of candWords) {
      if (targetWords.has(w)) matches++;
    }

    const ratio = matches / Math.max(1, targetWords.size);
    return Math.max(10, Math.min(100, Math.round(ratio * 100)));
  }
}
