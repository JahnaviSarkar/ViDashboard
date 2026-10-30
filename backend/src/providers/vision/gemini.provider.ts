import { VisionProvider, VisionAnalysisParams, ProductAnalysis, productAnalysisSchema } from './types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { safeFetch } from '../../utils/ssrf';

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
  "isTextDerived": false,
  "isMock": false
}
Do NOT include markdown formatting, backticks, or explanatory preamble. Output strictly the raw JSON object.`;

export class GeminiVisionProvider implements VisionProvider {
  public readonly name = 'gemini';

  constructor(
    private apiKey?: string,
    private modelName?: string
  ) {}

  async analyze(params: VisionAnalysisParams): Promise<ProductAnalysis> {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError('MISSING_API_KEY', 'GEMINI_API_KEY is not configured', 500, {}, false);
    }

    let imageBuffer = params.imageBuffer;
    let mimeType = params.imageMimeType || 'image/jpeg';

    if (!imageBuffer && params.imageUrl) {
      try {
        const imgRes = await safeFetch(params.imageUrl, { timeoutMs: 8000, maxBytes: 10 * 1024 * 1024 });
        if (imgRes.buffer.length > 0) {
          imageBuffer = imgRes.buffer;
          if (imgRes.contentType) mimeType = imgRes.contentType.split(';')[0];
        }
      } catch (err) {
        logger.warn({ err, url: params.imageUrl }, 'Failed to fetch image buffer from imageUrl in GeminiVisionProvider');
      }
    }

    const hasImage = Boolean(imageBuffer);
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

    if (imageBuffer) {
      // Check magic bytes for mimeType if generic
      if (imageBuffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
        mimeType = 'image/png';
      } else if (imageBuffer.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
        mimeType = 'image/jpeg';
      } else if (imageBuffer.slice(0, 4).toString() === 'RIFF') {
        mimeType = 'image/webp';
      }

      const base64Data = imageBuffer.toString('base64');
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
        const { textContent, modelUsed } = await this.callGeminiApi(key, parts, attempt > 1 ? lastError?.message : undefined);
        const parsed = this.parseAndValidateJson(textContent, !hasImage);
        parsed.modelUsed = modelUsed;
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
  ): Promise<{ textContent: string; modelUsed: string }> {
    const configuredModel = this.modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    let model = configuredModel;
    if (model === 'gemini-2.5-flash') {
      logger.warn(
        { configuredModel: 'gemini-2.5-flash', actualModel: 'gemini-3.5-flash-lite' },
        'Gemini provider fell back to a different model than GEMINI_MODEL: gemini-2.5-flash is deprecated by Google Gemini API, using gemini-3.5-flash-lite'
      );
      model = 'gemini-3.5-flash-lite';
    }

    let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

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

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });

    // Fallback if model is deprecated (e.g. 2.5-flash returning 404 in current Gemini API) or temporary 503
    if (!res.ok && (res.status === 404 || res.status === 503) && model !== 'gemini-3.5-flash-lite') {
      const fallbackModel = 'gemini-3.5-flash-lite';
      logger.warn(
        { configuredModel, actualModel: fallbackModel, status: res.status },
        `Gemini provider fell back to a different model than GEMINI_MODEL: ${model} returned HTTP ${res.status}, falling back to ${fallbackModel}`
      );
      model = fallbackModel;
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });
    }

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

    return { textContent, modelUsed: model };
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
    parsed.isMock = false;

    return productAnalysisSchema.parse(parsed);
  }
}
