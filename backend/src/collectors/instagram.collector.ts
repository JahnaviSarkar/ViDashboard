import { Collector, CollectorOptions, CollectorResult, RawVideoCandidate } from './types';
import { GeneratedQueries } from '../services/query-generator.service';
import { safeFetch } from '../utils/ssrf';
import { logger } from '../utils/logger';

export interface InstagramCollectorConfig {
  token?: string;
  mode?: 'live' | 'mock';
  igUserId?: string;
}

export class InstagramCollector implements Collector {
  readonly source = 'instagram' as const;
  private token?: string;
  private mode: 'live' | 'mock';
  private igUserId?: string;

  constructor(config?: InstagramCollectorConfig) {
    this.token = config?.token || process.env.INSTAGRAM_ACCESS_TOKEN;
    this.mode = config?.mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
    this.igUserId = config?.igUserId || process.env.INSTAGRAM_USER_ID;
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
    const hashtags = queries.instagram.hashtags.length > 0 ? queries.instagram.hashtags : ['#trending', '#musthave'];
    const keywords = queries.instagram.keywords.length > 0 ? queries.instagram.keywords : ['Product Review'];

    const creators = [
      'lifestyle_trends',
      'daily_finds_official',
      'unboxing_queen',
      'curated_gear',
      'aesthetic_daily',
      'tech_and_style',
      'honest_reviews_hub',
      'glow_and_style',
      'product_scout',
      'viral_picks',
    ];

    for (let i = 0; i < targetCount; i++) {
      const id = `mock_ig_reel_${(i + 1).toString().padStart(3, '0')}`;
      const tag1 = hashtags[i % hashtags.length];
      const tag2 = hashtags[(i + 1) % hashtags.length];
      const keyword = keywords[i % keywords.length];
      const author = creators[i % creators.length];

      candidates.push({
        platform: 'instagram',
        platformVideoId: id,
        canonicalUrl: `https://www.instagram.com/reel/${id}/`,
        thumbnailUrl: `https://images.example.com/mock/thumbnails/${id}.jpg`,
        mediaUrl: `https://video.example.com/mock/reels/${id}.mp4`,
        caption: `Obsessed with this! Real review of the ${keyword}. Check this out ${tag1} ${tag2} #viral #foryou`,
        author: `@${author}`,
        postedAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 4), // Staggered over recent days
        raw: {
          mockType: 'instagram_reel',
          likes: 1200 + i * 187,
          comments: 45 + i * 9,
          views: 18500 + i * 1230,
        },
        isMock: true,
      });
    }

    return {
      source: 'instagram',
      requested: targetCount,
      collected: candidates.length,
      usable: candidates.length,
      shortfall: Math.max(0, targetCount - candidates.length),
      candidates,
    };
  }

  private async collectLive(queries: GeneratedQueries, targetCount: number): Promise<CollectorResult> {
    if (!this.token || this.token.trim() === '') {
      logger.warn('InstagramCollector: INSTAGRAM_ACCESS_TOKEN not configured in live mode');
      return {
        source: 'instagram',
        requested: targetCount,
        collected: 0,
        usable: 0,
        shortfall: targetCount,
        candidates: [],
        error: 'INSTAGRAM_ACCESS_TOKEN is not configured in environment',
      };
    }

    const candidates: RawVideoCandidate[] = [];
    const seenIds = new Set<string>();
    let lastError: string | undefined;

    const hashtagsToSearch = queries.instagram.hashtags
      .map((h) => h.replace(/^#/, '').trim())
      .filter(Boolean);

    for (const tag of hashtagsToSearch) {
      if (candidates.length >= targetCount) break;

      try {
        // Step 1: Search hashtag ID if user_id is provided
        const userId = this.igUserId || 'me';
        const searchUrl = `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=${userId}&q=${encodeURIComponent(
          tag
        )}&access_token=${this.token}`;

        const searchRes = await safeFetch(searchUrl, { timeoutMs: 8000 });
        if (searchRes.statusCode !== 200) {
          const errBody = JSON.parse(searchRes.text || '{}');
          lastError = errBody?.error?.message || `Hashtag search failed with HTTP ${searchRes.statusCode}`;
          logger.warn({ tag, error: lastError }, 'Instagram hashtag search query failed');
          continue;
        }

        const searchData = JSON.parse(searchRes.text);
        const hashtagId = searchData.data?.[0]?.id;
        if (!hashtagId) continue;

        // Step 2: Fetch recent media for the hashtag
        const mediaUrl = `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?user_id=${userId}&fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&access_token=${this.token}`;
        const mediaRes = await safeFetch(mediaUrl, { timeoutMs: 8000 });

        if (mediaRes.statusCode === 200) {
          const mediaData = JSON.parse(mediaRes.text);
          const items = mediaData.data || [];

          for (const item of items) {
            // Filter strictly for VIDEO type
            if (item.media_type === 'VIDEO' && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              candidates.push({
                platform: 'instagram',
                platformVideoId: item.id,
                canonicalUrl: item.permalink || `https://www.instagram.com/reel/${item.id}/`,
                thumbnailUrl: item.thumbnail_url,
                mediaUrl: item.media_url,
                caption: item.caption,
                author: item.username ? `@${item.username}` : undefined,
                postedAt: item.timestamp ? new Date(item.timestamp) : undefined,
                raw: item,
                isMock: false,
              });

              if (candidates.length >= targetCount) break;
            }
          }
        }
      } catch (err: any) {
        lastError = err.message;
        logger.warn({ err, tag }, 'Error querying Instagram Graph API for hashtag');
      }
    }

    const usable = candidates.length;
    const shortfall = Math.max(0, targetCount - usable);

    return {
      source: 'instagram',
      requested: targetCount,
      collected: candidates.length,
      usable,
      shortfall,
      candidates,
      error: shortfall > 0 && lastError ? lastError : undefined,
    };
  }
}
