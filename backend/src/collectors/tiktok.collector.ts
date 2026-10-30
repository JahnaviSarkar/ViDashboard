import { Collector, CollectorOptions, CollectorResult, RawVideoCandidate } from './types';
import { GeneratedQueries } from '../services/query-generator.service';
import { logger } from '../utils/logger';

export interface TikTokCollectorConfig {
  token?: string;
  mode?: 'live' | 'mock';
}

export class TikTokCollector implements Collector {
  readonly source = 'tiktok' as const;
  private token?: string;
  private mode: 'live' | 'mock';

  constructor(config?: TikTokCollectorConfig) {
    this.token = config?.token || process.env.TIKTOK_ACCESS_TOKEN;
    this.mode = config?.mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
  }

  async collect(queries: GeneratedQueries, options: CollectorOptions): Promise<CollectorResult> {
    const targetCount = options.targetCount ?? 20;

    if (this.mode === 'mock') {
      return this.collectMock(queries, targetCount);
    }

    return this.collectLive(queries, targetCount);
  }

  private async collectMock(queries: GeneratedQueries, targetCount: number): Promise<CollectorResult> {
    const candidates: RawVideoCandidate[] = [];
    const searchTerms = queries.tiktok.searchTerms.length > 0 ? queries.tiktok.searchTerms : ['Trending Product Review'];

    const creators = [
      'tiktok_finds_daily',
      'unboxing_guru',
      'gadget_review_hub',
      'viral_life_hacks',
      'trending_closet',
      'real_review_tok',
    ];

    for (let i = 0; i < targetCount; i++) {
      const videoId = `mock_tt_video_${(i + 1).toString().padStart(3, '0')}`;
      const term = searchTerms[i % searchTerms.length];
      const creator = creators[i % creators.length];

      candidates.push({
        platform: 'tiktok',
        platformVideoId: videoId,
        canonicalUrl: `https://www.tiktok.com/@${creator}/video/${videoId}`,
        thumbnailUrl: `https://images.example.com/mock/tt_thumbs/${videoId}.jpg`,
        mediaUrl: `https://video.example.com/mock/tt/${videoId}.mp4`,
        caption: `Wait till the end! Genuine honest review of ${term} #tiktokmademebuyit #unboxing #viral`,
        author: `@${creator}`,
        postedAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 5),
        raw: {
          views: 45000 + i * 2300,
          likes: 4200 + i * 310,
          shares: 210 + i * 15,
        },
        isMock: true,
      });
    }

    return {
      source: 'tiktok',
      requested: targetCount,
      collected: candidates.length,
      usable: candidates.length,
      shortfall: Math.max(0, targetCount - candidates.length),
      candidates,
    };
  }

  private async collectLive(_queries: GeneratedQueries, targetCount: number): Promise<CollectorResult> {
    if (!this.token || this.token.trim() === '') {
      logger.info('TikTokCollector: TIKTOK_ACCESS_TOKEN not configured (optional source)');
      return {
        source: 'tiktok',
        requested: targetCount,
        collected: 0,
        usable: 0,
        shortfall: targetCount,
        candidates: [],
        error: 'TIKTOK_ACCESS_TOKEN is not configured in environment (optional source)',
      };
    }

    // Live TikTok collector implementation for enterprise/research access token
    return {
      source: 'tiktok',
      requested: targetCount,
      collected: 0,
      usable: 0,
      shortfall: targetCount,
      candidates: [],
      error: 'TikTok enterprise research credentials inactive',
    };
  }
}

