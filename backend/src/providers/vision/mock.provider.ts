import { VisionProvider, VisionAnalysisParams, ProductAnalysis, productAnalysisSchema } from './types';

export class MockVisionProvider implements VisionProvider {
  public readonly name = 'mock';

  async analyze(params: VisionAnalysisParams): Promise<ProductAnalysis> {
    const title = params.title || 'Product Item';
    const desc = params.description || '';
    const hasImage = Boolean(params.imageBuffer || params.imageUrl);

    // Deterministically infer category and attributes from text
    const lower = `${title} ${desc}`.toLowerCase();

    let category = 'Consumer Goods';
    let productType = title;
    let dominantColour = 'Pastel Neutral';
    let secondaryColours = ['Soft Cream', 'Lilac Mist'];
    let material = 'Refined Synthetic';
    let shape = 'Contemporary ergonomic silhouette';
    const distinguishingAttributes: string[] = [];
    const logos: string[] = [];
    const visibleText: string[] = [];

    if (lower.includes('doll') || lower.includes('toy') || lower.includes('wooden') || lower.includes('play')) {
      category = 'Toys & Games / Pretend Play';
      productType = lower.includes('dollhouse') ? 'Wooden Miniature Dollhouse' : 'Artisan Wooden Toy';
      dominantColour = lower.includes('pink') ? 'Rose Blossom' : 'Natural Beech Wood';
      secondaryColours = ['Pastel Mint', 'Soft Coral'];
      material = 'FSC-Certified Solid Beech Wood';
      shape = 'Multi-storey cottage with pitched roof';
      distinguishingAttributes.push('Smooth chamfered edges', 'Non-toxic water-based glaze');
    } else if (lower.includes('headphone') || lower.includes('audio') || lower.includes('wireless') || lower.includes('ear')) {
      category = 'Electronics / Audio';
      productType = 'Wireless Over-Ear Noise-Cancelling Headphones';
      dominantColour = lower.includes('black') ? 'Matte Obsidian' : 'Silver Metallic';
      secondaryColours = ['Charcoal', 'Gunmetal Accent'];
      material = 'Anodized Aluminium and Memory Foam';
      shape = 'Curved ergonomic headband with oval earcups';
      distinguishingAttributes.push('Active noise-cancelling microphones', 'Tactile rotary dial');
      logos.push('SonicPro');
    } else if (lower.includes('bag') || lower.includes('backpack') || lower.includes('tote')) {
      category = 'Apparel & Accessories / Bags';
      productType = 'Everyday Commuter Backpack';
      dominantColour = 'Deep Navy';
      secondaryColours = ['Tan Leather Trim', 'Matte Black Hardware'];
      material = 'Water-resistant Recycled Cordura';
      shape = 'Structured roll-top silhouette';
      distinguishingAttributes.push('Padded laptop compartment', 'Magnetic quick-snap latch');
    } else if (lower.includes('bottle') || lower.includes('flask') || lower.includes('tumbler') || lower.includes('hydration')) {
      category = 'Kitchen & Dining / Hydration';
      productType = 'Insulated Stainless Steel Water Bottle';
      dominantColour = 'Sage Green Powder Coat';
      secondaryColours = ['Brushed Steel', 'Silicone Gray'];
      material = '18/8 Pro-Grade Stainless Steel';
      shape = 'Cylindrical with loop carry cap';
      distinguishingAttributes.push('Double-wall vacuum insulation', 'Laser-etched brandmark');
    } else if (lower.includes('keyboard') || lower.includes('keycap') || lower.includes('switch')) {
      category = 'Electronics / Peripherals';
      productType = 'Custom Mechanical Keyboard';
      dominantColour = 'Charcoal Slate';
      secondaryColours = ['Accent Cyan', 'Warm White'];
      material = 'CNC Anodized Aluminium';
      shape = 'Compact angled tenkeyless profile';
      distinguishingAttributes.push('Hot-swappable tactile switches', 'RGB per-key illumination');
    } else if (lower.includes('gloss') || lower.includes('lip') || lower.includes('beauty') || lower.includes('cosmetic')) {
      category = 'Beauty / Lips';
      productType = 'Universal Lip Gloss';
      dominantColour = 'Rose Gold Shimmer';
      secondaryColours = ['Champagne Nude'];
      material = 'Hydrating Gloss Formula';
      shape = 'Prismatic cylindrical wand applicator';
      distinguishingAttributes.push('Non-sticky high-shine finish', 'Peach vanilla scent');
    } else {
      distinguishingAttributes.push('Precision engineered', 'Matte finish');
    }

    const rawAnalysis: ProductAnalysis = {
      productType,
      category,
      dominantColour,
      secondaryColours,
      printsAndGraphics: lower.includes('print') || lower.includes('pattern') ? ['Geometric Micro-print'] : [],
      logos,
      visibleText,
      material,
      shape,
      distinguishingAttributes,
      attributeConfidence: {
        productType: hasImage ? 0.95 : 0.85,
        category: 0.92,
        dominantColour: hasImage ? 0.94 : 0.75,
        material: 0.88,
        shape: 0.91,
      },
      isTextDerived: !hasImage,
      isMock: true,
      modelUsed: 'mock',
    };

    return productAnalysisSchema.parse(rawAnalysis);
  }
}
