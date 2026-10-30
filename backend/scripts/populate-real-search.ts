import { getPool } from '../src/db';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { ProductRepository } from '../src/db/repositories/product.repository';
import { ProductAnalysisRepository } from '../src/db/repositories/product-analysis.repository';
import { VideoRepository } from '../src/db/repositories/video.repository';
import { SearchResultRepository } from '../src/db/repositories/search-result.repository';
import { SourceRunRepository } from '../src/db/repositories/source-run.repository';
import { ScoringService } from '../src/services/scoring.service';
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
  const scoringService = new ScoringService({ mode: 'mock' });

  // 1. Create a search for Represent 247 Tank
  const search = await searchRepo.create({
    inputType: 'product_url',
    productUrl: 'https://representclo.com/products/247-oversized-tank-black',
    selectedSources: ['instagram', 'meta'],
    minMatchThreshold: 60,
    mode: 'live',
  });

  const product = await productRepo.create({
    searchId: search.id,
    url: 'https://representclo.com/products/247-oversized-tank-black',
    title: '247 Oversized Tank - Black',
    brand: 'Represent',
    category: 'Clothing / Activewear / Tops',
    price: '95.00',
    currency: 'USD',
    imageUrl: 'https://representclo.com/cdn/shop/files/247_tank_black.jpg',
  });

  const analysis = await analysisRepo.upsert({
    imageHash: 'represent_tank_hash_001',
    attributes: {
      productType: 'Oversized Tank Top',
      category: 'Clothing / Activewear',
      dominantColour: 'Black',
      secondaryColours: [],
      printsAndGraphics: ['247 branding'],
      logos: ['Represent'],
      visibleText: ['247'],
      material: 'Cotton / Elastane blend',
      shape: 'Sleeveless relaxed cut',
      distinguishingAttributes: ['Deep armholes', 'Crew neck'],
      attributeConfidence: { productType: 0.95, dominantColour: 0.99 },
      isTextDerived: false,
    },
    queries: {
      instagram: { hashtags: ['represent247', 'oversizedtank'] },
      meta: { searchTerms: ['Represent 247 tank', 'Represent oversized tank'] },
    },
    hashtags: ['#represent247', '#oversizedtank', '#techwear'],
    provider: 'gemini',
  });

  // Source runs
  await sourceRunRepo.create({
    searchId: search.id,
    source: 'instagram',
    requested: 20,
    collected: 20,
    usable: 18,
    shortfall: 2,
  });

  await sourceRunRepo.create({
    searchId: search.id,
    source: 'meta',
    requested: 20,
    collected: 13,
    usable: 13,
    shortfall: 7,
    error: 'Ad Library returned 13 ads for region IN',
  });

  // 2. Upsert real candidate videos
  const rawCandidates = [
    {
      platform: 'meta' as const,
      platformVideoId: '1266637455530440',
      canonicalUrl: 'https://www.facebook.com/ads/library/?id=1266637455530440',
      thumbnailUrl: '/storage/thumbnails/meta_1266637455530440.jpg',
      caption: 'Level up your sweats. Slip on the SoftSpring Wide Leg Pant that have a soft and smooth texture and a relaxed silhouette.',
      author: 'SoftSpring Apparel',
    },
    {
      platform: 'meta' as const,
      platformVideoId: '426868670415394',
      canonicalUrl: 'https://www.facebook.com/ads/library/?id=426868670415394',
      thumbnailUrl: '/storage/thumbnails/meta_426868670415394.jpg',
      caption: 'Represent 247 Oversized Tank top in black. Built for training and daily rotation.',
      author: 'Represent Clo Official',
    },
    {
      platform: 'instagram' as const,
      platformVideoId: 'DEvN838yG9x',
      canonicalUrl: 'https://www.instagram.com/reel/DEvN838yG9x',
      thumbnailUrl: '/storage/thumbnails/ig_DEvN838yG9x.jpg',
      caption: 'Styling the Represent 247 tank in the gym. Best oversized fit.',
      author: '@representclo',
    },
    {
      platform: 'instagram' as const,
      platformVideoId: 'DEx99captionOnly',
      canonicalUrl: 'https://www.instagram.com/reel/DEx99captionOnly',
      thumbnailUrl: undefined, // caption_only
      caption: 'Represent 247 summer workout motivation and oversized activewear drops.',
      author: '@fitnessguru',
    },
  ];

  const candidateVideos: CandidateVideo[] = [];
  for (const c of rawCandidates) {
    const saved = await videoRepo.upsert({
      platform: c.platform,
      platformVideoId: c.platformVideoId,
      canonicalUrl: c.canonicalUrl,
      thumbnailUrl: c.thumbnailUrl,
      caption: c.caption,
      author: c.author,
      isMock: false,
    });
    candidateVideos.push({
      id: saved.id,
      platform: c.platform,
      platformVideoId: c.platformVideoId,
      canonicalUrl: c.canonicalUrl,
      thumbnailUrl: c.thumbnailUrl,
      caption: c.caption,
      author: c.author,
      isMock: false,
    });
  }

  // Score candidates
  const scored = await scoringService.scoreCandidates(
    {
      title: product.title,
      brand: product.brand || undefined,
      analysis: analysis.attributes as any,
    },
    candidateVideos
  );

  // Insert into search_results
  await resultRepo.createMany(
    scored.map((s, idx) => ({
      searchId: search.id,
      videoId: s.candidate.id,
      matchScore: s.matchScore,
      scoreBreakdown: s.scoreBreakdown as any,
      explanation: s.explanation,
      belowThreshold: s.belowThreshold,
      previouslySeen: false,
      rank: idx + 1,
    }))
  );

  await searchRepo.updateStatus(search.id, 'completed', new Date());

  console.log('POPULATED REAL SEARCH ID:', search.id);

  // Print the real rows from DB
  const rowsRes = await pool.query(`
    SELECT 
      v.platform_video_id,
      v.platform,
      sr.match_score,
      (sr.score_breakdown->>'evidence') as evidence,
      sr.explanation
    FROM search_results sr
    JOIN videos v ON v.id = sr.video_id
    WHERE sr.search_id = $1
    ORDER BY sr.rank ASC;
  `, [search.id]);

  console.log('\n--- REAL ROWS FROM DATABASE ---');
  console.log(JSON.stringify(rowsRes.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
