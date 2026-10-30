import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InstagramCollector } from '../src/collectors/instagram.collector';
import { MetaAdLibraryCollector } from '../src/collectors/meta-ad-library.collector';
import { TikTokCollector } from '../src/collectors/tiktok.collector';
import { ApifyClient } from '../src/providers/apify/client';
import { VideoRepository } from '../src/db/repositories/video.repository';
import { SourceRunRepository } from '../src/db/repositories/source-run.repository';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { PipelineOrchestratorService } from '../src/services/pipeline-orchestrator.service';
import { GeneratedQueries } from '../src/services/query-generator.service';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';

describe('Phase 3 Collectors & Shortfall Accounting', () => {
  const sampleQueries: GeneratedQueries = {
    instagram: {
      hashtags: ['#lipgloss', '#fentybeauty', '#glossbomb', '#makeuphaves'],
      keywords: ['Fenty Beauty Lip Gloss', 'Gloss Bomb Lip Luminizer'],
    },
    meta: {
      searchTerms: ['Fenty Beauty', 'Gloss Bomb sale', 'Lip Luminizer'],
    },
    tiktok: {
      searchTerms: ['Fenty Lip Gloss review', 'unboxing Gloss Bomb'],
    },
    expansionTiers: {
      tier1: ['Fenty Beauty Gloss Bomb'],
      tier2: ['Rose Pink Lip Gloss'],
      tier3: ['Beauty & Personal Care / Cosmetics'],
    },
  };

  beforeAll(async () => {
    await ensurePostgresRunning();
    await runMigrations();
  });

  describe('Instagram Reels Collector', () => {
    it('in mock mode, generates >= 20 valid candidate videos with isMock: true', async () => {
      const collector = new InstagramCollector({ mode: 'mock' });
      const result = await collector.collect(sampleQueries, {
        targetCount: 20,
        searchId: 'test-search-ig-mock',
      });

      expect(result.source).toBe('instagram');
      expect(result.requested).toBe(20);
      expect(result.collected).toBe(20);
      expect(result.usable).toBe(20);
      expect(result.shortfall).toBe(0);
      expect(result.candidates.length).toBe(20);

      for (const cand of result.candidates) {
        expect(cand.platform).toBe('instagram');
        expect(cand.isMock).toBe(true);
        expect(cand.canonicalUrl).toMatch(/https:\/\/www\.instagram\.com\/reel\//);
        expect(cand.caption).toBeDefined();
        expect(cand.author?.startsWith('@')).toBe(true);
      }
    });

    it('in live mode without token, gracefully reports shortfall 20 with clear error', async () => {
      const collector = new InstagramCollector({
        mode: 'live',
        token: '',
        apifyClient: new ApifyClient(''),
      });
      const result = await collector.collect(sampleQueries, {
        targetCount: 20,
        searchId: 'test-search-ig-live',
      });

      expect(result.source).toBe('instagram');
      expect(result.requested).toBe(20);
      expect(result.collected).toBe(0);
      expect(result.usable).toBe(0);
      expect(result.shortfall).toBe(20);
      expect(result.candidates.length).toBe(0);
      expect(result.error).toContain('configured in environment');
    });
  });

  describe('Meta Ad Library Collector', () => {
    it('in mock mode, generates >= 20 commercial ad candidates with isMock: true', async () => {
      const collector = new MetaAdLibraryCollector({ mode: 'mock' });
      const result = await collector.collect(sampleQueries, {
        targetCount: 20,
        searchId: 'test-search-meta-mock',
      });

      expect(result.source).toBe('meta');
      expect(result.requested).toBe(20);
      expect(result.collected).toBe(20);
      expect(result.usable).toBe(20);
      expect(result.shortfall).toBe(0);
      expect(result.candidates.length).toBe(20);

      for (const cand of result.candidates) {
        expect(cand.platform).toBe('meta');
        expect(cand.isMock).toBe(true);
        expect(cand.canonicalUrl).toMatch(/facebook\.com\/ads\/library/);
        expect(cand.caption).toBeDefined();
        expect(cand.author).toBeDefined();
      }
    });

    it('in live mode without token, gracefully reports shortfall 20 with clear error', async () => {
      const collector = new MetaAdLibraryCollector({
        mode: 'live',
        token: '',
        apifyClient: new ApifyClient(''),
      });
      const result = await collector.collect(sampleQueries, {
        targetCount: 20,
        searchId: 'test-search-meta-live',
      });

      expect(result.source).toBe('meta');
      expect(result.requested).toBe(20);
      expect(result.collected).toBe(0);
      expect(result.usable).toBe(0);
      expect(result.shortfall).toBe(20);
      expect(result.candidates.length).toBe(0);
      expect(result.error).toContain('configured in environment');
    });
  });

  describe('TikTok Collector (Optional Source)', () => {
    it('in mock mode, generates >= 20 candidate videos with isMock: true', async () => {
      const collector = new TikTokCollector({ mode: 'mock' });
      const result = await collector.collect(sampleQueries, {
        targetCount: 20,
        searchId: 'test-search-tt-mock',
      });

      expect(result.source).toBe('tiktok');
      expect(result.requested).toBe(20);
      expect(result.collected).toBe(20);
      expect(result.usable).toBe(20);
      expect(result.shortfall).toBe(0);
      expect(result.candidates.length).toBe(20);
      expect(result.candidates[0].isMock).toBe(true);
    });

    it('in live mode without token, reports unconfigured optional status without crashing', async () => {
      const collector = new TikTokCollector({ mode: 'live', token: '' });
      const result = await collector.collect(sampleQueries, {
        targetCount: 20,
        searchId: 'test-search-tt-live',
      });

      expect(result.source).toBe('tiktok');
      expect(result.shortfall).toBe(20);
      expect(result.error).toContain('TIKTOK_ACCESS_TOKEN is not configured');
    });
  });

  describe('Database Upsert and Deduplication', () => {
    const videoRepo = new VideoRepository();

    it('upserting duplicate video updates existing record without throwing error', async () => {
      const cand1 = await videoRepo.upsert({
        platform: 'instagram',
        platformVideoId: 'unique_test_reel_101',
        canonicalUrl: 'https://www.instagram.com/reel/unique_test_reel_101/',
        caption: 'First version caption',
        author: '@creator_one',
        isMock: true,
      });

      expect(cand1.id).toBeDefined();

      const cand2 = await videoRepo.upsert({
        platform: 'instagram',
        platformVideoId: 'unique_test_reel_101',
        canonicalUrl: 'https://www.instagram.com/reel/unique_test_reel_101/',
        caption: 'Updated version caption',
        author: '@creator_one',
        isMock: true,
      });

      expect(cand2.id).toBe(cand1.id);
      expect(cand2.caption).toBe('Updated version caption');
    });
  });

  describe('Pipeline Integration with Parallel Collectors', () => {
    const searchRepo = new SearchRepository();
    const sourceRunRepo = new SourceRunRepository();
    const orchestrator = new PipelineOrchestratorService({ mode: 'mock' });

    it('records source_runs rows with accurate counts and shortfall for each active collector', async () => {
      const search = await searchRepo.create({
        inputType: 'keyword',
        queryText: 'Oversized Streetwear Hoodie',
        selectedSources: ['instagram', 'meta'],
        minMatchThreshold: 60,
        mode: 'mock',
      });

      await orchestrator.execute(search.id);

      const runs = await sourceRunRepo.getBySearchId(search.id);
      expect(runs.length).toBe(2);

      const igRun = runs.find((r) => r.source === 'instagram');
      expect(igRun).toBeDefined();
      expect(igRun?.status).toBe('completed');
      expect(igRun?.requested).toBe(20);
      expect(igRun?.collected).toBe(20);
      expect(igRun?.usable).toBe(20);
      expect(igRun?.shortfall).toBe(0);

      const metaRun = runs.find((r) => r.source === 'meta');
      expect(metaRun).toBeDefined();
      expect(metaRun?.status).toBe('completed');
      expect(metaRun?.requested).toBe(20);
      expect(metaRun?.collected).toBe(20);
      expect(metaRun?.usable).toBe(20);
      expect(metaRun?.shortfall).toBe(0);
    });
  });
});
