import { z } from 'zod';

export const productAnalysisSchema = z.object({
  productType: z.string().min(1, 'Product type is required'),
  category: z.string().min(1, 'Category is required'),
  dominantColour: z.string().min(1, 'Dominant colour is required'),
  secondaryColours: z.array(z.string()).default([]),
  printsAndGraphics: z.array(z.string()).default([]),
  logos: z.array(z.string()).default([]),
  visibleText: z.array(z.string()).default([]),
  material: z.string().min(1, 'Material is required'),
  shape: z.string().min(1, 'Shape description is required'),
  distinguishingAttributes: z.array(z.string()).default([]),
  attributeConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  isTextDerived: z.boolean().default(false),
  isMock: z.boolean().default(false),
  modelUsed: z.string().optional(),
});

export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

export interface VisionAnalysisParams {
  title?: string;
  description?: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
  imageMimeType?: string;
}

export interface VisionProvider {
  name: string;
  analyze(params: VisionAnalysisParams): Promise<ProductAnalysis>;
}
