import { ProductAnalysis } from '../providers/vision/types';
import { isMarketplace } from './product-resolver.service';

export interface GeneratedQueries {
  instagram: {
    hashtags: string[];
    keywords: string[];
  };
  meta: {
    searchTerms: string[];
  };
  tiktok: {
    searchTerms: string[];
  };
  expansionTiers: {
    tier1: string[]; // Exact: specific product type + brand/distinguishing features
    tier2: string[]; // Attribute-broadened: product type + dominant color + material
    tier3: string[]; // Category-level: broad category + general search terms
  };
}

const STANDALONE_MATERIALS = new Set([
  'plastic',
  'metallic',
  'metal',
  'polyester',
  'synthetic',
  'acrylic',
  'plasticandmetallic',
  'stainlesssteel',
]);

const STYLE_KEYWORDS = [
  'techwear',
  'streetwear',
  'athleisure',
  'minimalist',
  'oversized',
  'y2k',
  'vintage',
  'luxury',
  'workout',
  'fitness',
  'running',
  'gymwear',
  'glam',
  'shimmer',
  'matte',
  'casual',
  'lifestyle',
  'aesthetic',
  'activewear',
];

/**
 * Validates that a hashtag conforms to quality rules:
 * - 1 to 3 words, length 3 to 25 chars (including '#')
 * - No material strings
 * - No "products" suffix or word
 * - Alphanumeric only
 */
export function isValidHashtag(tag: string): boolean {
  if (!tag || !tag.startsWith('#')) return false;
  if (tag.length < 3 || tag.length > 25) return false;
  const lower = tag.toLowerCase();
  if (lower.includes('products')) return false;
  const bare = lower.slice(1);
  if (STANDALONE_MATERIALS.has(bare)) return false;
  return /^#[a-z0-9]{2,24}$/i.test(tag);
}

export class QueryGeneratorService {
  /**
   * Generates tailored per-platform queries and expansion tiers from structured product analysis.
   */
  generate(analysis: ProductAnalysis, brandName?: string): GeneratedQueries {
    const cleanWord = (w: string) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 1. Validate real brand (never use marketplace names like Amazon, Walmart in queries)
    const isRealBrand = Boolean(brandName && !isMarketplace(brandName));
    const cleanBrand = isRealBrand ? brandName!.trim() : undefined;

    // 2. Build high-quality, searchable hashtags
    const hashtagsSet = new Set<string>();

    const tryAddTag = (raw: string) => {
      const cleaned = cleanWord(raw);
      if (!cleaned) return;
      const tag = `#${cleaned}`;
      if (isValidHashtag(tag)) {
        hashtagsSet.add(tag);
      }
    };

    // A. Product type hashtags
    const productSlug = cleanWord(analysis.productType);
    tryAddTag(productSlug);

    // Split product type into concise 1-2 word concepts if multi-word
    const productWords = analysis.productType.split(/\s+/).map(cleanWord).filter(Boolean);
    if (productWords.length > 1) {
      // Last 2 words (e.g. "tank top", "running shoes")
      tryAddTag(productWords.slice(-2).join(''));
      // First 2 words (e.g. "oversized tank", "lip gloss")
      tryAddTag(productWords.slice(0, 2).join(''));
      // Main noun (last word)
      tryAddTag(productWords[productWords.length - 1]);
    }

    // B. Real Brand hashtag (only if real product brand)
    if (cleanBrand) {
      tryAddTag(cleanBrand);
    }

    // C. Category hashtags
    const categoryParts = analysis.category
      .split(/[/,&]/)
      .map((p) => cleanWord(p.trim()))
      .filter((p) => p.length >= 3 && p.length <= 20);

    for (const cat of categoryParts) {
      if (!cat.includes('products')) {
        tryAddTag(cat);
      }
    }

    // D. Style & Concept words (from attributes, description, productType)
    const fullContext = `${analysis.productType} ${analysis.category} ${analysis.shape} ${analysis.distinguishingAttributes.join(' ')}`.toLowerCase();
    for (const style of STYLE_KEYWORDS) {
      if (fullContext.includes(style)) {
        tryAddTag(style);
      }
    }

    // E. Distinctive Visible Text & Logos (avoiding marketplace names)
    for (const logo of analysis.logos) {
      if (!isMarketplace(logo)) {
        const logoWords = logo.split(/\s+/).map(cleanWord).filter((w) => w.length > 1);
        for (const lw of logoWords) {
          tryAddTag(lw);
        }
        if (logoWords.length > 1) {
          tryAddTag(logoWords.join(''));
        }
      }
    }

    for (const text of analysis.visibleText) {
      const textWords = text.split(/\s+/).map(cleanWord).filter((w) => w.length >= 3 && w.length <= 15);
      for (const tw of textWords) {
        if (!isMarketplace(tw)) {
          tryAddTag(tw);
        }
      }
    }

    // General high-traffic discovery hashtags (clean, short, relevant)
    tryAddTag('productfinds');
    tryAddTag('musthaves');

    const rankedHashtags = Array.from(hashtagsSet)
      .filter(isValidHashtag)
      .slice(0, 15);

    // 3. Build Instagram keyword queries (never using marketplace name as brand)
    const igKeywords: string[] = [];
    if (cleanBrand) igKeywords.push(`${cleanBrand} ${analysis.productType}`);
    igKeywords.push(analysis.productType);
    igKeywords.push(`${analysis.dominantColour} ${analysis.productType}`);
    igKeywords.push(`${analysis.material} ${analysis.productType}`);

    // 4. Build Meta Ad Library search terms (commercial intent, 2 to 4 word phrases)
    // Rule: Don't use bare brand-ish or numeric terms (e.g. "247"). Combine brand + product type ("Represent oversized tank").
    const metaTermsSet = new Set<string>();

    const tryAddMetaTerm = (phrase: string) => {
      const clean = phrase.trim().replace(/\s+/g, ' ');
      const words = clean.split(' ').filter(Boolean);
      // Strictly 2 to 4 words, never bare single terms or purely numeric strings
      if (words.length < 2 || words.length > 4) return;
      if (/^\d+$/.test(clean.replace(/\s+/g, ''))) return;
      if (words.some((w) => isMarketplace(w))) return;
      metaTermsSet.add(clean);
    };

    if (cleanBrand) {
      tryAddMetaTerm(`${cleanBrand} ${analysis.productType}`);
      tryAddMetaTerm(`${cleanBrand} ${analysis.productType} sale`);
      const conciseType = analysis.productType.split(/\s+/).slice(0, 2).join(' ');
      tryAddMetaTerm(`${cleanBrand} ${conciseType}`);

      // Allow multi-word non-numeric brand names (e.g. "Fenty Beauty", "Pastel Play Co.")
      // but strictly reject bare 1-word or numeric terms (e.g. "247", "Represent")
      const brandWords = cleanBrand.split(/\s+/).filter(Boolean);
      if (brandWords.length >= 2 && brandWords.length <= 4 && !/^\d+$/.test(cleanBrand)) {
        tryAddMetaTerm(cleanBrand);
      }
    }

    tryAddMetaTerm(`${analysis.productType} sale`);
    tryAddMetaTerm(analysis.productType);
    tryAddMetaTerm(`${analysis.dominantColour} ${analysis.productType}`);
    if (analysis.distinguishingAttributes.length > 0) {
      tryAddMetaTerm(`${analysis.productType} ${analysis.distinguishingAttributes[0]}`);
    }

    const metaSearchTerms = Array.from(metaTermsSet).slice(0, 6);

    // 5. Build TikTok queries
    const tiktokSearchTerms: string[] = [];
    if (cleanBrand) tiktokSearchTerms.push(`${cleanBrand} ${analysis.productType}`);
    tiktokSearchTerms.push(`${analysis.productType} review`);
    tiktokSearchTerms.push(`best ${analysis.productType} 2026`);
    tiktokSearchTerms.push(`unboxing ${analysis.productType}`);

    // 6. Build Expansion Tiers
    // Tier 1 (Exact): Real brand + specific product type + primary distinguishing attribute
    const tier1: string[] = [];
    if (cleanBrand) tier1.push(`${cleanBrand} ${analysis.productType}`);
    tier1.push(analysis.productType);
    if (analysis.distinguishingAttributes.length > 0) {
      tier1.push(`${analysis.productType} ${analysis.distinguishingAttributes[0]}`);
    }

    // Tier 2 (Attribute-Broadened): Product type + dominant colour / material
    const tier2: string[] = [];
    tier2.push(`${analysis.dominantColour} ${analysis.productType}`);
    tier2.push(`${analysis.material} ${analysis.productType}`);
    if (analysis.shape) {
      tier2.push(`${analysis.shape} ${analysis.productType}`);
    }

    // Tier 3 (Category-Level): Broad category terms & generic discovery
    const tier3: string[] = [];
    for (const cat of categoryParts) {
      tier3.push(cat);
    }
    tier3.push(`popular ${categoryParts[0] || 'products'}`);

    return {
      instagram: {
        hashtags: rankedHashtags,
        keywords: igKeywords.filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
      },
      meta: {
        searchTerms: metaSearchTerms.filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
      },
      tiktok: {
        searchTerms: tiktokSearchTerms.slice(0, 4),
      },
      expansionTiers: {
        tier1: tier1.filter((v, i, a) => a.indexOf(v) === i),
        tier2: tier2.filter((v, i, a) => a.indexOf(v) === i),
        tier3: tier3.filter((v, i, a) => a.indexOf(v) === i),
      },
    };
  }
}
