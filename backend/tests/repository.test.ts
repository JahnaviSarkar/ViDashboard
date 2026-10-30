import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { closeDb, getPool } from '../src/db';
import { runMigrations } from '../src/db/migrate';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { ProductRepository } from '../src/db/repositories/product.repository';
import { ProductAnalysisRepository } from '../src/db/repositories/product-analysis.repository';
import { VideoRepository } from '../src/db/repositories/video.repository';
import { SearchResultRepository } from '../src/db/repositories/search-result.repository';
import { SeenVideoRepository } from '../src/db/repositories/seen-video.repository';
import { SourceRunRepository } from '../src/db/repositories/source-run.repository';
import { CacheRepository } from '../src/db/repositories/cache.repository';
import { randomUUID } from 'crypto';

describe('Repository Layer and Constraint Verification', () => {
  const searchRepo = new SearchRepository();
  const productRepo = new ProductRepository();
  const analysisRepo = new ProductAnalysisRepository();
  const videoRepo = new VideoRepository();
  const searchResultRepo = new SearchResultRepository();
  const seenVideoRepo = new SeenVideoRepository();
  const sourceRunRepo = new SourceRunRepository();
  const cacheRepo = new CacheRepository();

  beforeAll(async () => {
    await ensurePostgresRunning();
    await runMigrations();
  });


  it('verifies unique constraint on videos (platform, platform_video_id)', async () => {
    const platform = 'instagram';
    const platformVideoId = `reel_${Date.now()}`;

    // 1. First insert via repository
    const video1 = await videoRepo.upsert({
      platform,
      platformVideoId,
      canonicalUrl: `https://instagram.com/reel/${platformVideoId}`,
      caption: 'Original caption',
      author: 'creator1',
      isMock: false,
    });
    expect(video1.id).toBeDefined();
    expect(video1.caption).toBe('Original caption');

    // 2. Upsert with updated caption on same (platform, platformVideoId) updates the existing record
    const video2 = await videoRepo.upsert({
      platform,
      platformVideoId,
      canonicalUrl: `https://instagram.com/reel/${platformVideoId}`,
      caption: 'Updated caption',
      author: 'creator1',
      isMock: false,
    });
    expect(video2.id).toBe(video1.id);
    expect(video2.caption).toBe('Updated caption');

    // 3. Direct raw insert with duplicate key must trigger PostgreSQL unique violation code 23505
    const pool = getPool();
    await expect(
      pool.query(
        'INSERT INTO videos (id, platform, platform_video_id, canonical_url) VALUES ($1, $2, $3, $4);',
        [randomUUID(), platform, platformVideoId, 'https://another-url.com']
      )
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('verifies unique constraint on product_analyses (image_hash)', async () => {
    const imageHash = `hash_${Date.now()}`;

    const analysis1 = await analysisRepo.upsert({
      imageHash,
      attributes: { category: 'toys', dominantColour: 'pink' },
      queries: { tier1: ['wooden dollhouse'] },
      hashtags: { instagram: ['#woodentoys'] },
      provider: 'gemini',
    });
    expect(analysis1.imageHash).toBe(imageHash);

    // Upsert updates attributes for same imageHash
    const analysis2 = await analysisRepo.upsert({
      imageHash,
      attributes: { category: 'toys', dominantColour: 'magenta' },
      queries: { tier1: ['luxury dollhouse'] },
      hashtags: { instagram: ['#woodentoys', '#luxury'] },
      provider: 'gemini',
    });
    expect(analysis2.id).toBe(analysis1.id);

    // Raw direct insert should fail with unique constraint violation
    const pool = getPool();
    await expect(
      pool.query(
        'INSERT INTO product_analyses (id, image_hash, attributes, queries, hashtags, provider) VALUES ($1, $2, $3, $4, $5, $6);',
        [randomUUID(), imageHash, '{}', '{}', '{}', 'gemini']
      )
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('SearchRepository creates, retrieves, and updates search lifecycle', async () => {
    const search = await searchRepo.create({
      inputType: 'product_url',
      productUrl: 'https://example.com/product/wooden-doll',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 70,
      mode: 'live',
      status: 'pending',
    });

    expect(search.id).toBeDefined();
    expect(search.status).toBe('pending');

    const fetched = await searchRepo.getById(search.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.productUrl).toBe('https://example.com/product/wooden-doll');

    const updated = await searchRepo.updateStatus(search.id, 'completed', new Date());
    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).toBeDefined();

    const history = await searchRepo.getHistory(5);
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((s) => s.id === search.id)).toBe(true);
  });

  it('ProductRepository links product details to search', async () => {
    const search = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'ergonomic baby carrier',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const product = await productRepo.create({
      searchId: search.id,
      title: 'Ergonomic 360 Baby Carrier',
      description: 'Comfortable mesh carrier for newborns',
      imageUrl: 'https://images.example.com/carrier.jpg',
      imageHash: 'carrier_hash_123',
      metadata: { brand: 'Ergobaby', price: 179.99 },
    });

    expect(product.searchId).toBe(search.id);
    const fetched = await productRepo.getBySearchId(search.id);
    expect(fetched?.title).toBe('Ergonomic 360 Baby Carrier');
  });

  it('SearchResultRepository persists ranked results and supports joins', async () => {
    const search = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'smart water bottle',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const video = await videoRepo.upsert({
      platform: 'meta',
      platformVideoId: `meta_ad_${Date.now()}`,
      canonicalUrl: 'https://facebook.com/ads/12345',
      caption: 'Stay hydrated with our LED reminder bottle',
      author: 'HydraSmart',
      isMock: false,
    });

    await searchResultRepo.create({
      searchId: search.id,
      videoId: video.id,
      matchScore: 88.5,
      scoreBreakdown: { embeddingScore: 85, rubricScore: 92, finalScore: 88.5 },
      explanation: 'Matches shape and LED logo clearly',
      rank: 1,
    });

    const results = await searchResultRepo.getWithVideos(search.id);
    expect(results.length).toBe(1);
    expect(results[0].result.matchScore).toBeCloseTo(88.5, 1);
    expect(results[0].video.platform).toBe('meta');
  });

  it('SeenVideoRepository tracks returned videos across searches', async () => {
    const search1 = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'run 1',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const video = await videoRepo.upsert({
      platform: 'instagram',
      platformVideoId: `seen_reel_${Date.now()}`,
      canonicalUrl: 'https://instagram.com/reel/seen1',
      isMock: false,
    });

    expect(await seenVideoRepo.isSeen(video.id)).toBe(false);

    // Mark seen on search 1
    const seenFirst = await seenVideoRepo.markSeen(video.id, search1.id);
    expect(seenFirst.timesReturned).toBe(1);
    expect(await seenVideoRepo.isSeen(video.id)).toBe(true);

    // Seen again on search 2 -> increments timesReturned
    const search2 = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'run 2',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const seenSecond = await seenVideoRepo.markSeen(video.id, search2.id);
    expect(seenSecond.timesReturned).toBe(2);
  });

  it('SourceRunRepository tracks per-source counts and shortfalls', async () => {
    const search = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'desk lamp',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const run = await sourceRunRepo.create({
      searchId: search.id,
      source: 'instagram',
      requested: 20,
      collected: 14,
      usable: 14,
      shortfall: 6,
      status: 'completed',
    });

    expect(run.shortfall).toBe(6);
    expect(run.usable).toBe(14);

    const fetchedRuns = await sourceRunRepo.getBySearchId(search.id);
    expect(fetchedRuns.length).toBe(1);
    expect(fetchedRuns[0].source).toBe('instagram');
  });

  it('CacheRepository stores and retrieves entries, respecting TTL', async () => {
    const cacheKey = `url_cache_${Date.now()}`;
    const payload = { title: 'Cached Product', brand: 'Acme' };

    await cacheRepo.set(cacheKey, payload, 3600); // 1 hour TTL
    const cached = await cacheRepo.get(cacheKey);
    expect(cached).toEqual(payload);

    // Test expired entry
    const expiredKey = `expired_${Date.now()}`;
    await cacheRepo.set(expiredKey, { test: true }, -10); // Expired 10s ago
    const expiredResult = await cacheRepo.get(expiredKey);
    expect(expiredResult).toBeNull();
  });
});
