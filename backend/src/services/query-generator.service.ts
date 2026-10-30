import { ProductAnalysis } from '../providers/vision/types';

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

export class QueryGeneratorService {
  /**
   * Generates tailored per-platform queries and expansion tiers from structured product analysis.
   */
  generate(analysis: ProductAnalysis, brandName?: string): GeneratedQueries {
    const cleanWord = (w: string) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 1. Build hashtag list with ranked broad & niche mix
    const hashtagsSet = new Set<string>();

    // Niche product hashtags
    const productSlug = cleanWord(analysis.productType);
    if (productSlug) hashtagsSet.add(`#${productSlug}`);

    if (brandName) {
      hashtagsSet.add(`#${cleanWord(brandName)}`);
    }

    for (const logo of analysis.logos) {
      const cleanLogo = cleanWord(logo);
      if (cleanLogo) hashtagsSet.add(`#${cleanLogo}`);
    }

    // Attribute hashtags (niche)
    const colorSlug = cleanWord(analysis.dominantColour);
    const materialSlug = cleanWord(analysis.material);
    if (colorSlug && productSlug) hashtagsSet.add(`#${colorSlug}${productSlug}`);
    if (materialSlug) hashtagsSet.add(`#${materialSlug}products`);

    for (const attr of analysis.distinguishingAttributes) {
      const words = attr.split(' ').map(cleanWord).filter((w) => w.length > 2);
      if (words.length >= 2) {
        hashtagsSet.add(`#${words.slice(0, 2).join('')}`);
      }
    }

    // Broad category hashtags
    const categoryParts = analysis.category.split(/[/,&]/).map((p) => cleanWord(p.trim())).filter(Boolean);
    for (const cat of categoryParts) {
      if (cat.length > 3) hashtagsSet.add(`#${cat}`);
    }

    // General high-traffic discovery hashtags
    hashtagsSet.add('#productfinds');
    hashtagsSet.add('#musthaves');

    // Filter out banned/generic mock hashtags
    const bannedHashtags = new Set([
      '#compositeblendproducts',
      '#compositeblend',
      '#ergonomicpremium',
      '#ergonomicpremiumproducts',
      '#minimalistaesthetic',
      '#minimalistaestheticproducts',
    ]);

    const rankedHashtags = Array.from(hashtagsSet)
      .filter((tag) => !bannedHashtags.has(tag))
      .slice(0, 15);

    // 2. Build Instagram keyword queries
    const igKeywords: string[] = [];
    if (brandName) igKeywords.push(`${brandName} ${analysis.productType}`);
    igKeywords.push(analysis.productType);
    igKeywords.push(`${analysis.dominantColour} ${analysis.productType}`);
    igKeywords.push(`${analysis.material} ${analysis.productType}`);

    // 3. Build Meta Ad Library search terms (commercial intent)
    const metaSearchTerms: string[] = [];
    if (brandName) metaSearchTerms.push(brandName);
    metaSearchTerms.push(analysis.productType);
    metaSearchTerms.push(`${analysis.productType} sale`);
    metaSearchTerms.push(`${analysis.dominantColour} ${analysis.productType}`);

    // 4. Build TikTok queries
    const tiktokSearchTerms: string[] = [];
    tiktokSearchTerms.push(`${analysis.productType} review`);
    tiktokSearchTerms.push(`best ${analysis.productType} 2026`);
    tiktokSearchTerms.push(`unboxing ${analysis.productType}`);

    // 5. Build Expansion Tiers
    // Tier 1 (Exact): Brand + specific product type + primary distinguishing attribute
    const tier1: string[] = [];
    if (brandName) tier1.push(`${brandName} ${analysis.productType}`);
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
