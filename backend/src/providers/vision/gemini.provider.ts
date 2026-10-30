import { VisionProvider, VisionAnalysisParams, ProductAnalysis, productAnalysisSchema } from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const SYSTEM_INSTRUCTION = `You are an expert product vision analyst and e-commerce visual discovery system ("Image Brain").
Your goal is to inspect product images and descriptions, and return an accurate, structured JSON analysis of visual and physical product attributes.
You MUST output ONLY a valid JSON object matching this exact schema:
{
  "productType": "string (specific name, e.g. 'Wooden Miniature Dollhouse' or 'Wireless Noise-Cancelling Headphones')",
  "category": "string (broad category e.g. 'Toys & Games / Pretend Play')",
  "dominantColour": "string (main color name e.g. 'Rose Pink', 'Matte Black', 'Sage Green')",
  "secondaryColours": ["string (accent colors)"],
  "printsAndGraphics": ["string (visible patterns, stripes, florals, graphics)"],
  "logos": ["string (visible brand names, emblems, logos)"],
  "visibleText": ["string (any legible text visible on product or packaging)"],
  "material": "string (e.g. 'Natural Beech Wood', 'Anodized Aluminum', 'Stainless Steel')",
  "shape": "string (detailed physical form factor and geometry)",
  "distinguishingAttributes": ["string (unique selling points, tactile features, key visual identifiers)"],
  "attributeConfidence": {
    "productType": 0.95,
    "dominantColour": 0.90,
    "category": 0.92,
    "material": 0.85,
    "shape": 0.90
  },
  "isTextDerived": false
}
Do NOT include markdown formatting, backticks, or explanatory preamble. Output strictly the raw JSON object.`;

export class GeminiVisionProvider implements VisionProvider {
  public readonly name = 'gemini';

  constructor(private apiKey?: string) {}

  async analyze(params: VisionAnalysisParams): Promise<ProductAnalysis> {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError('MISSING_API_KEY', 'GEMINI_API_KEY is not configured', 500, {}, false);
    }

    const hasImage = Boolean(params.imageBuffer || params.imageUrl);
    const title = params.title || 'Unknown Product';
    const desc = params.description || '';

    // Prepare contents array for Gemini REST API
    const parts: Array<Record<string, unknown>> = [];

    let promptText = `Product Title: "${title}"\nProduct Description: "${desc}"\n`;
    if (!hasImage) {
      promptText += `\nNOTE: No image was provided. Analyze the product attributes strictly based on the provided title and text. Set "isTextDerived": true and estimate visual attributes based on standard category norms.\n`;
    } else {
      promptText += `\nInspect the attached product image carefully. Identify all visual colors, materials, patterns, logos, and geometry.\n`;
    }

    parts.push({ text: promptText });

    if (params.imageBuffer) {
      const mimeType = params.imageMimeType || 'image/jpeg';
      const base64Data = params.imageBuffer.toString('base64');
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    // Call Gemini API with 1 repair retry
    let lastError: Error | null = null;
    let attempt = 0;
    const maxAttempts = 2; // Initial attempt + 1 repair retry

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const responseJsonText = await this.callGeminiApi(key, parts, attempt > 1 ? lastError?.message : undefined);
        const parsed = this.parseAndValidateJson(responseJsonText, !hasImage);
        return parsed;
      } catch (err: any) {
        lastError = err;
        logger.warn({ attempt, err: err.message }, 'Gemini vision analysis attempt failed');
        if (attempt >= maxAttempts) {
          throw new AppError('IMAGE_ANALYSIS_FAILED', `Vision analysis failed after ${maxAttempts} attempts: ${err.message}`, 502, {}, true);
        }
      }
    }

    throw new AppError('IMAGE_ANALYSIS_FAILED', 'Failed to obtain structured analysis from Gemini Vision', 502, {}, true);
  }

  private async callGeminiApi(
    key: string,
    parts: Array<Record<string, unknown>>,
    repairFeedback?: string
  ): Promise<string> {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const requestBodyParts = [...parts];
    if (repairFeedback) {
      requestBodyParts.push({
        text: `\nPREVIOUS ERROR: Your previous JSON output failed validation with error: "${repairFeedback}". Please correct the JSON syntax and ensure every required schema property is provided with non-empty values.\n`,
      });
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: requestBodyParts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API HTTP ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as any;
    const candidate = data.candidates && data.candidates[0];
    const textContent = candidate?.content?.parts && candidate.content.parts[0]?.text;

    if (!textContent) {
      throw new Error('Gemini API returned an empty response body or blocked output');
    }

    return textContent;
  }

  private parseAndValidateJson(rawText: string, forceTextDerived: boolean): ProductAnalysis {
    // Strip possible markdown fences
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    if (forceTextDerived) {
      parsed.isTextDerived = true;
    }

    return productAnalysisSchema.parse(parsed);
  }
}
