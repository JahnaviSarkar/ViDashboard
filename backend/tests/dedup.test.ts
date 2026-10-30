import { describe, it, expect, vi } from 'vitest';
import { jaccardSimilarity, isTextNearDuplicate } from '../src/utils/text-similarity';
import { DedupService } from '../src/services/dedup.service';
import { CandidateVideo } from '../src/types';

describe('Deduplication & Cross-Search Filtering (Phase 4)', () => {
  describe('Text Jaccard Similarity', () => {
    it('computes word token Jaccard similarity accurately', () => {
      const text1 = 'Fenty Beauty Gloss Bomb Universal Lip Luminizer review';
      const text2 = 'fenty beauty gloss bomb universal lip luminizer swatch review';
      const sim = jaccardSimilarity(text1, text2);
      expect(sim).toBeGreaterThan(0.7);

      const unrelated = 'Brand new heavy duty pickup truck engine for sale';
      expect(jaccardSimilarity(text1, unrelated)).toBe(0);
    });

    it('identifies text near-duplicates based on 0.85 threshold', () => {
      const text1 = 'Check out this stunning new summer collection outfit from Represent Clothing!';
      const text2 = 'Check out this stunning new summer collection outfit from Represent Clothing! Link';
      expect(isTextNearDuplicate(text1, text2, 0.85)).toBe(true);

      const different = 'Completely different tech gadget review for noise cancelling headphones';
      expect(isTextNearDuplicate(text1, different, 0.85)).toBe(false);
    });
  });

  describe('DedupService Within-Search Clustering & Cross-Search Filtering', () => {
    it('clusters near-duplicates within the same search using dHash and Jaccard similarity', async () => {
      const mockSeenRepo: any = {
        getSeenMap: vi.fn().mockResolvedValue(new Map()),
        markSeen: vi.fn().mockResolvedValue(undefined),
      };

      const dedupService = new DedupService(mockSeenRepo);

      const items = [
        {
          id: 'v1',
          candidate: {
            id: 'v1',
            platform: 'instagram' as const,
            platformVideoId: 'post_1001',
            canonicalUrl: 'https://instagram.com/reel/1001',
            caption: 'Fenty Beauty Gloss Bomb swatch and review by Sarah',
            mediaPhash: '1111222233334444',
            isMock: true,
          },
          matchScore: 88,
        },
        // Duplicate by dHash (Hamming distance = 1 bit <= 10)
        {
          id: 'v2',
          candidate: {
            id: 'v2',
            platform: 'instagram' as const,
            platformVideoId: 'post_1002',
            canonicalUrl: 'https://instagram.com/reel/1002',
            caption: 'Re-uploaded Sarah review reel',
            mediaPhash: '1111222233334445', // 1 bit diff
            isMock: true,
          },
          matchScore: 85,
        },
        // Duplicate by Text Jaccard similarity (identical caption)
        {
          id: 'v3',
          candidate: {
            id: 'v3',
            platform: 'meta' as const,
            platformVideoId: 'ad_3001',
            canonicalUrl: 'https://facebook.com/ad/3001',
            caption: 'Fenty Beauty Gloss Bomb swatch and review by Sarah',
            mediaPhash: 'ffffffffffffffff', // Different image hash
            isMock: true,
          },
          matchScore: 84,
        },
        // Distinct third candidate
        {
          id: 'v4',
          candidate: {
            id: 'v4',
            platform: 'meta' as const,
            platformVideoId: 'ad_4001',
            canonicalUrl: 'https://facebook.com/ad/4001',
            caption: 'Represent Clothing oversized tank top gym fit check',
            mediaPhash: '0000000000000000',
            isMock: true,
          },
          matchScore: 78,
        },
      ];

      const result = await dedupService.deduplicateAndFilter(items, {
        searchId: 'search-123',
        dHashThreshold: 10,
        textJaccardThreshold: 0.85,
        excludePreviouslySeen: true,
      });

      // v2 and v3 should be flagged as duplicates of v1
      expect(result.duplicatesRemoved).toBe(2);
      expect(result.uniqueCandidates).toHaveLength(2); // v1 and v4
      expect(result.uniqueCandidates[0].candidate.id).toBe('v1');
      expect(result.uniqueCandidates[1].candidate.id).toBe('v4');

      const v2Processed = result.allProcessed.find((p) => p.candidate.id === 'v2');
      expect(v2Processed?.duplicateOf).toBe('v1');

      const v3Processed = result.allProcessed.find((p) => p.candidate.id === 'v3');
      expect(v3Processed?.duplicateOf).toBe('v1');
    });

    it('filters cross-search previously seen videos when excludePreviouslySeen is true', async () => {
      const seenMap = new Map();
      seenMap.set('seen_video_1', { videoId: 'seen_video_1', timesReturned: 1 });

      const mockSeenRepo: any = {
        getSeenMap: vi.fn().mockResolvedValue(seenMap),
        markSeen: vi.fn().mockResolvedValue(undefined),
      };

      const dedupService = new DedupService(mockSeenRepo);

      const items = [
        {
          id: 'seen_video_1',
          candidate: {
            id: 'seen_video_1',
            platform: 'instagram' as const,
            platformVideoId: 'seen_video_1',
            canonicalUrl: 'https://instagram.com/reel/seen1',
            caption: 'Previously seen video',
            isMock: true,
          },
          matchScore: 92,
        },
        {
          id: 'new_video_2',
          candidate: {
            id: 'new_video_2',
            platform: 'instagram' as const,
            platformVideoId: 'new_video_2',
            canonicalUrl: 'https://instagram.com/reel/new2',
            caption: 'Brand new video never seen before',
            isMock: true,
          },
          matchScore: 89,
        },
      ];

      const result = await dedupService.deduplicateAndFilter(items, {
        searchId: 'search-456',
        excludePreviouslySeen: true,
      });

      expect(result.previouslySeenFiltered).toBe(1);
      expect(result.uniqueCandidates).toHaveLength(1);
      expect(result.uniqueCandidates[0].candidate.id).toBe('new_video_2');

      const seenItem = result.allProcessed.find((p) => p.candidate.id === 'seen_video_1');
      expect(seenItem?.previouslySeen).toBe(true);
    });
  });
});
