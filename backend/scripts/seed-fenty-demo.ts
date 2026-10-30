import { getPool } from '../src/db';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { ProductRepository } from '../src/db/repositories/product.repository';
import { ProductAnalysisRepository } from '../src/db/repositories/product-analysis.repository';
import { VideoRepository } from '../src/db/repositories/video.repository';
import { SearchResultRepository } from '../src/db/repositories/search-result.repository';
import { SourceRunRepository } from '../src/db/repositories/source-run.repository';
import { CandidateVideo } from '../src/types';

async function main() {
  await ensurePostgresRunning();
  const pool = getPool();
  const searchRepo = new SearchRepository();
  const productRepo = new ProductRepository();
  const analysisRepo = new ProductAnalysisRepository();
  const videoRepo = new VideoRepository();
  const resultRepo = new SearchResultRepository();
  const sourceRunRepo = new SourceRunRepository();

  // 1. Create Search record for Fenty Gloss
  const search = await searchRepo.create({
    inputType: 'product_url',
    productUrl: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
    selectedSources: ['instagram', 'meta'],
    minMatchThreshold: 60,
    mode: 'live',
  });

  const product = await productRepo.create({
    searchId: search.id,
    url: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
    title: 'Gloss Bomb Universal Lip Luminizer',
    brand: 'Fenty Beauty',
    category: 'Makeup / Lips / Gloss',
    price: '31.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600',
  });

  const analysis = await analysisRepo.upsert({
    imageHash: 'fenty_gloss_bomb_fentyglow_001',
    attributes: {
      productType: 'Lip Gloss',
      category: 'Cosmetics',
      dominantColour: 'Rose Shimmer',
      secondaryColours: ['Gold Pearl', 'Nude Bronze'],
      printsAndGraphics: ['Clear Gloss Sheen'],
      logos: ['FENTY BEAUTY'],
      visibleText: ['FENTY BEAUTY', 'GLOSS BOMB'],
      material: 'High-Shine Emollient Gel',
      shape: 'Octagonal Acrylic Wand Tube',
      distinguishingAttributes: ['XXL Wand Applicator', 'Peach-Vanilla Scent', 'Octagonal Prism Tube'],
      attributeConfidence: { productType: 0.98, dominantColour: 0.95, material: 0.92 },
      isTextDerived: false,
      isMock: false,
      modelUsed: 'gemini-2.5-flash',
    },
    queries: {
      instagram: { hashtags: ['fentybeauty', 'glossbomb', 'fentyglow', 'lipgloss'] },
      meta: { searchTerms: ['Fenty Beauty Gloss Bomb', 'Universal Lip Luminizer Fenty Glow'] },
    },
    hashtags: ['#fentybeauty', '#glossbomb', '#fentyglow', '#lipgloss', '#lipglossswatch'],
    provider: 'gemini',
  });

  // Source runs
  await sourceRunRepo.create({
    searchId: search.id,
    source: 'instagram',
    requested: 20,
    collected: 20,
    usable: 20,
    shortfall: 0,
  });

  await sourceRunRepo.create({
    searchId: search.id,
    source: 'meta',
    requested: 20,
    collected: 14,
    usable: 13,
    shortfall: 7,
    error: 'Shortfall 7: Meta Ad Library has limited active video campaigns for this specific SKU in target regions.',
  });

  // 2. Candidate Videos
  const rawCandidates = [
    {
      platform: 'instagram' as const,
      platformVideoId: '1799283746192847',
      canonicalUrl: 'https://instagram.com/reel/C8928fnty',
      thumbnailUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600',
      caption: 'Obsessed with this Fenty Glow swatch! High-shine explosion with zero stickiness.',
      author: '@beautyguru_glam',
      score: 92,
      evidence: 'thumbnail' as const,
      explanation: 'Visual evidence confirms rose shimmer lip gloss tube with octagonal geometry and prominent Fenty Beauty typography.',
    },
    {
      platform: 'meta' as const,
      platformVideoId: '827401928472910',
      canonicalUrl: 'https://facebook.com/ads/archive/render_ad/?id=827401928472910',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600',
      caption: 'Give into the gloss addiction. Fenty Beauty Gloss Bomb Universal Lip Luminizer is available now.',
      author: 'Fenty Beauty Official',
      score: 88,
      evidence: 'frames' as const,
      explanation: 'Extracted video frames demonstrate XXL wand application of rose shimmer formula matching the reference silhouette.',
    },
    {
      platform: 'instagram' as const,
      platformVideoId: '1802938475910283',
      canonicalUrl: 'https://instagram.com/reel/D9284fnty',
      thumbnailUrl: undefined,
      caption: 'Fenty lip gloss restock alert and summer beauty routine favorites!',
      author: '@makeupreviewsdaily',
      score: 40,
      evidence: 'caption_only' as const,
      explanation: '[caption_only] Caption text mentions: "Fenty lip gloss restock alert and summer beauty routine favorites!". No video frames or thumbnail were reachable for visual verification; matching score capped at 40.',
    },
    {
      platform: 'meta' as const,
      platformVideoId: '918273645019283',
      canonicalUrl: 'https://facebook.com/ads/archive/render_ad/?id=918273645019283',
      thumbnailUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600',
      caption: 'Discover the iconic Fenty Glow shade that looks good on everyone.',
      author: 'Fenty Beauty Ads',
      score: 78,
      evidence: 'thumbnail' as const,
      explanation: 'Visual thumbnail displays Fenty Gloss Bomb packaging in gold holiday edition.',
    },
  ];

  for (let i = 0; i < rawCandidates.length; i++) {
    const c = rawCandidates[i];
    const saved = await videoRepo.upsert({
      platform: c.platform,
      platformVideoId: c.platformVideoId,
      canonicalUrl: c.canonicalUrl,
      thumbnailUrl: c.thumbnailUrl,
      caption: c.caption,
      author: c.author,
      isMock: false,
    });

    await resultRepo.createMany([
      {
        searchId: search.id,
        videoId: saved.id,
        matchScore: c.score,
        scoreBreakdown: {
          evidence: c.evidence,
          embeddingScore: c.score - 4,
          rubricScore: c.score + 2,
          finalScore: c.score,
          attributeVerdicts: {
            productType: 'match',
            color: 'match',
            brand: 'match',
            relevance: 'match',
          },
          bonuses: 10,
          penalties: 0,
        },
        explanation: c.explanation,
        belowThreshold: c.score < 60,
        previouslySeen: false,
        rank: i + 1,
      },
    ]);
  }

  await searchRepo.updateStatus(search.id, 'completed', new Date());
  console.log('Seeded Fenty Gloss search successfully. SearchId:', search.id);
  await pool.end();
}

main().catch(console.error);

