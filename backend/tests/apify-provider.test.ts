import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApifyClient } from '../src/providers/apify/client';
import { InstagramCollector } from '../src/collectors/instagram.collector';
import { MetaAdLibraryCollector } from '../src/collectors/meta-ad-library.collector';
import { AppError } from '../src/utils/errors';
import { GeneratedQueries } from '../src/services/query-generator.service';

describe('Apify Provider & Reliability Layer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const sampleQueries: GeneratedQueries = {
    instagram: {
      hashtags: ['#lipgloss', '#fentybeauty'],
      keywords: ['Lip Gloss'],
    },
    meta: {
      searchTerms: ['Fenty Beauty'],
    },
    tiktok: {
      searchTerms: ['Lip Gloss review'],
    },
    expansionTiers: {
      tier1: ['Fenty Beauty'],
      tier2: ['Lip Gloss'],
      tier3: ['Cosmetics'],
    },
  };

  describe('ApifyClient Reliability & Edge Cases', () => {
    let client: ApifyClient;

    beforeEach(() => {
      client = new ApifyClient('mock-apify-token');
    });

    it('handles success response with dataset items', async () => {
      const mockItems = [
        { id: 'item1', shortCode: 'SC1', type: 'Video', videoUrl: 'https://cdn.example.com/1.mp4' },
        { id: 'item2', shortCode: 'SC2', type: 'Video', videoUrl: 'https://cdn.example.com/2.mp4' },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockItems),
      });

      const result = await client.callActorSync('test-actor', { foo: 'bar' });
      expect(result).toEqual(mockItems);
      expect(result.length).toBe(2);
    });

    it('handles empty response gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '[]',
      });

      const result = await client.callActorSync('test-actor', { foo: 'bar' });
      expect(result).toEqual([]);
    });

    it('throws APIFY_MALFORMED_OUTPUT on invalid JSON output', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html>Not Valid JSON</html>',
      });

      await expect(client.callActorSync('test-actor', {})).rejects.toThrowError(AppError);
      try {
        await client.callActorSync('test-actor', {});
      } catch (err: any) {
        expect(err.code).toBe('APIFY_MALFORMED_OUTPUT');
        expect(err.statusCode).toBe(502);
      }
    });

    it('throws APIFY_TIMEOUT on request abort/timeout', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(client.callActorSync('test-actor', {}, { timeoutSeconds: 1 })).rejects.toThrowError(AppError);
      try {
        await client.callActorSync('test-actor', {}, { timeoutSeconds: 1 });
      } catch (err: any) {
        expect(err.code).toBe('APIFY_TIMEOUT');
        expect(err.statusCode).toBe(504);
        expect(err.retryable).toBe(true);
      }
    });

    it('throws APIFY_QUOTA_EXCEEDED on HTTP 402 payment/quota limit', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'Monthly usage limit exceeded for free tier',
      });

      await expect(client.callActorSync('test-actor', {})).rejects.toThrowError(AppError);
      try {
        await client.callActorSync('test-actor', {});
      } catch (err: any) {
        expect(err.code).toBe('APIFY_QUOTA_EXCEEDED');
        expect(err.statusCode).toBe(402);
        expect(err.retryable).toBe(false);
      }
    });

    it('retries with backoff on 429 rate limit before succeeding', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Too Many Requests',
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ id: 'retried-success' }]),
        };
      });

      const result = await client.callActorSync('test-actor', {});
      expect(callCount).toBe(2);
      expect(result).toEqual([{ id: 'retried-success' }]);
    });

    it('trips circuit breaker after consecutive failures and fast-fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      // Cause 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await client.callActorSync('test-actor', {});
        } catch {}
      }

      // 4th call should immediately trip circuit breaker
      await expect(client.callActorSync('test-actor', {})).rejects.toThrowError(AppError);
      try {
        await client.callActorSync('test-actor', {});
      } catch (err: any) {
        expect(err.code).toBe('CIRCUIT_BREAKER_OPEN');
        expect(err.statusCode).toBe(503);
      }
    });
  });

  describe('Collector Normalisation & Video Filtering', () => {
    it('Instagram collector filters out static photos and keeps video items only', async () => {
      const mockApifyClient = {
        hasToken: () => true,
        callActorSync: vi.fn().mockResolvedValue([
          // Static Image (should be rejected)
          {
            id: 'photo_101',
            type: 'Image',
            displayUrl: 'https://example.com/p101.jpg',
            caption: 'Just a photo',
          },
          // Video Item (should be accepted)
          {
            id: 'video_102',
            type: 'Video',
            displayUrl: 'https://example.com/v102_thumb.jpg',
            videoUrl: 'https://example.com/v102.mp4',
            caption: 'Watch my video #lipgloss',
            ownerUsername: 'beautymaker',
          },
          // Missing thumbnail (should be rejected)
          {
            id: 'video_103',
            type: 'Video',
            videoUrl: 'https://example.com/v103.mp4',
            caption: 'Video without thumb',
          },
        ]),
      } as unknown as ApifyClient;

      const mockCacheRepo = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      } as any;

      const collector = new InstagramCollector({
        token: undefined, // no graph api token
        apifyClient: mockApifyClient,
        cacheRepo: mockCacheRepo,
        mode: 'live',
      });

      const result = await collector.collect(sampleQueries, { targetCount: 10, searchId: 'norm-test' });

      // Only video_102 should be retained
      expect(result.collected).toBe(1);
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].platformVideoId).toBe('video_102');
      expect(result.candidates[0].thumbnailUrl).toBeDefined();
    });

    it('Meta Ad Library collector extracts video ads from cards and rejects image-only ads', async () => {
      const mockApifyClient = {
        hasToken: () => true,
        callActorSync: vi.fn().mockResolvedValue([
          // Static image ad (no video in cards)
          {
            ad_archive_id: 'ad_static_1',
            snapshot: {
              cards: [{ original_image_url: 'https://example.com/img.jpg' }],
              body: { text: 'Static banner' },
            },
          },
          // Video ad with cards
          {
            ad_archive_id: 'ad_video_2',
            page_name: 'Fenty Official',
            snapshot: {
              cards: [
                {
                  video_hd_url: 'https://example.com/ad2.mp4',
                  video_preview_image_url: 'https://example.com/ad2_thumb.jpg',
                  body: 'Watch this Fenty tutorial',
                },
              ],
            },
          },
        ]),
      } as unknown as ApifyClient;

      const mockCacheRepo = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      } as any;

      const collector = new MetaAdLibraryCollector({
        token: undefined, // no graph api token
        apifyClient: mockApifyClient,
        cacheRepo: mockCacheRepo,
        mode: 'live',
      });

      const result = await collector.collect(sampleQueries, { targetCount: 10, searchId: 'norm-meta-test' });

      expect(result.collected).toBe(1);
      expect(result.candidates[0].platformVideoId).toBe('ad_video_2');
      expect(result.candidates[0].mediaUrl).toBe('https://example.com/ad2.mp4');
      expect(result.candidates[0].author).toBe('Fenty Official');
    });
  });
});
