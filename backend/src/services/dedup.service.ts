import { areDHashNearDuplicates } from '../utils/phash';
import { isTextNearDuplicate } from '../utils/text-similarity';
import { CandidateVideo } from '../types';
import { SeenVideoRepository } from '../db/repositories/seen-video.repository';
import { logger } from '../utils/logger';

export interface DedupCandidateItem {
  id: string;
  candidate: CandidateVideo;
  matchScore: number;
  duplicateOf?: string;
  previouslySeen?: boolean;
}

export interface DedupResult<T extends { candidate: CandidateVideo }> {
  uniqueCandidates: Array<
    T & {
      duplicateOf?: string;
      previouslySeen?: boolean;
    }
  >;
  duplicatesRemoved: number;
  previouslySeenFiltered: number;
  allProcessed: Array<
    T & {
      duplicateOf?: string;
      previouslySeen?: boolean;
    }
  >;
}

export class DedupService {
  private seenVideoRepo = new SeenVideoRepository();

  constructor(seenRepo?: SeenVideoRepository) {
    if (seenRepo) {
      this.seenVideoRepo = seenRepo;
    }
  }

  /**
   * Performs within-search near-duplicate clustering and cross-search seen video filtering
   */
  async deduplicateAndFilter<T extends { candidate: CandidateVideo; matchScore?: number }>(
    items: T[],
    options: {
      searchId: string;
      dHashThreshold?: number; // default 10
      textJaccardThreshold?: number; // default 0.85
      excludePreviouslySeen?: boolean; // default true
    }
  ): Promise<DedupResult<T>> {
    const dHashThreshold = options.dHashThreshold ?? 10;
    const textThreshold = options.textJaccardThreshold ?? 0.85;
    const excludePreviouslySeen = options.excludePreviouslySeen ?? true;

    logger.info(
      { itemCount: items.length, searchId: options.searchId },
      'Starting candidate deduplication and seen video filtering'
    );

    // 1. Fetch cross-search seen video map
    const videoIds = items.map((item) => item.candidate.id || item.candidate.platformVideoId);
    const seenMap = await this.seenVideoRepo.getSeenMap(videoIds);

    const processed: Array<T & { duplicateOf?: string; previouslySeen?: boolean }> = [];
    const clusterPrimaries: Array<T & { duplicateOf?: string; previouslySeen?: boolean }> = [];

    let duplicatesRemoved = 0;
    let previouslySeenFiltered = 0;

    for (const item of items) {
      const candId = item.candidate.id || item.candidate.platformVideoId;
      const isSeen = seenMap.has(candId);

      const enrichedItem: T & { duplicateOf?: string; previouslySeen?: boolean } = {
        ...item,
        previouslySeen: isSeen,
      };

      // Check if it should be filtered as previously seen
      if (isSeen && excludePreviouslySeen) {
        previouslySeenFiltered++;
        enrichedItem.previouslySeen = true;
        processed.push(enrichedItem);
        continue;
      }

      // 2. Check within-search near-duplicates against already accepted cluster primaries
      let isDuplicate = false;
      let matchedPrimaryId: string | undefined;

      for (const primary of clusterPrimaries) {
        // (a) Exact platformVideoId or canonicalUrl
        if (
          primary.candidate.platformVideoId === item.candidate.platformVideoId ||
          (primary.candidate.canonicalUrl &&
            item.candidate.canonicalUrl &&
            primary.candidate.canonicalUrl === item.candidate.canonicalUrl)
        ) {
          isDuplicate = true;
          matchedPrimaryId = primary.candidate.id || primary.candidate.platformVideoId;
          break;
        }

        // (b) Perceptual image hash (dHash) Hamming distance <= 10
        if (
          primary.candidate.mediaPhash &&
          item.candidate.mediaPhash &&
          areDHashNearDuplicates(primary.candidate.mediaPhash, item.candidate.mediaPhash, dHashThreshold)
        ) {
          isDuplicate = true;
          matchedPrimaryId = primary.candidate.id || primary.candidate.platformVideoId;
          break;
        }

        // (c) Text token Jaccard similarity >= 0.85
        if (
          primary.candidate.caption &&
          item.candidate.caption &&
          isTextNearDuplicate(primary.candidate.caption, item.candidate.caption, textThreshold)
        ) {
          isDuplicate = true;
          matchedPrimaryId = primary.candidate.id || primary.candidate.platformVideoId;
          break;
        }
      }

      if (isDuplicate) {
        duplicatesRemoved++;
        enrichedItem.duplicateOf = matchedPrimaryId;
        processed.push(enrichedItem);
      } else {
        clusterPrimaries.push(enrichedItem);
        processed.push(enrichedItem);
      }
    }

    logger.info(
      {
        totalInput: items.length,
        uniqueCount: clusterPrimaries.length,
        duplicatesRemoved,
        previouslySeenFiltered,
      },
      'Deduplication complete'
    );

    return {
      uniqueCandidates: clusterPrimaries,
      duplicatesRemoved,
      previouslySeenFiltered,
      allProcessed: processed,
    };
  }

  /**
   * Registers videos as seen in the seen_videos table for this search
   */
  async registerSeenVideos(videoIds: string[], searchId: string): Promise<void> {
    for (const vid of videoIds) {
      try {
        await this.seenVideoRepo.markSeen(vid, searchId);
      } catch (err: any) {
        logger.warn({ err: err.message, videoId: vid }, 'Failed to record video in seen_videos');
      }
    }
  }
}
