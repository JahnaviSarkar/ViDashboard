import { Collector, CollectorOptions, CollectorResult, RawVideoCandidate } from './types';
import { GeneratedQueries } from '../services/query-generator.service';
import { safeFetch } from '../utils/ssrf';
import { logger } from '../utils/logger';
import { ApifyClient } from '../providers/apify/client';
import { CacheRepository } from '../db/repositories/cache.repository';
import { downloadAndSaveThumbnail } from '../utils/thumbnail-storage';

export interface InstagramCollectorConfig {
  token?: string;
  apifyToken?: string;
  actorId?: string;
  mode?: 'live' | 'mock';
  igUserId?: string;
  apifyClient?: ApifyClient;
  cacheRepo?: CacheRepository;
}

export class InstagramCollector implements Collector {
  readonly source = 'instagram' as const;
  private token?: string;
  private mode: 'live' | 'mock';
  private igUserId?: string;
  private apifyClient: ApifyClient;
  private actorId: string;
  private cacheRepo: CacheRepository;

  constructor(config?: InstagramCollectorConfig) {
    this.token = config?.token !== undefined ? config.token : process.env.INSTAGRAM_ACCESS_TOKEN;
    this.mode = config?.mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
    this.igUserId = config?.igUserId || process.env.INSTAGRAM_USER_ID;
    this.apifyClient = config?.apifyClient || new ApifyClient(config?.apifyToken);
    this.actorId =
      config?.actorId ||
      process.env.APIFY_INSTAGRAM_ACTOR ||
      'apify/instagram-hashtag-scraper';
    this.cacheRepo = config?.cacheRepo || new CacheRepository();
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

    const localThumbs = [
      'instagram_2706863869879468651.jpg',
      'instagram_2724491944403426662.jpg',
      'instagram_3013554546328431752.jpg',
      'instagram_3304444182461907442.jpg',
      'instagram_3593209001224020651.jpg',
      'instagram_3661261626196574343.jpg',
      'instagram_3697659353774630804.jpg',
      'instagram_3698459817869042831.jpg',
      'instagram_3720065662895361908.jpg',
      'instagram_3875419381886357947.jpg',
      'instagram_3897775066338888268.jpg',
      'instagram_3898611466077068451.jpg',
      'instagram_3912790798953307020.jpg',
      'instagram_3915835296570515795.jpg',
      'instagram_3920589719163226004.jpg',
      'instagram_3921708589096489675.jpg',
      'instagram_3922219490497276314.jpg',
      'instagram_3938951595568123378.jpg',
      'instagram_3940493332317969199.jpg',
      'instagram_3954253353932565377.jpg',
    ];

    for (let i = 0; i < targetCount; i++) {
      const id = `mock_ig_reel_${(i + 1).toString().padStart(3, '0')}`;
      const tag1 = hashtags[i % hashtags.length];
      const tag2 = hashtags[(i + 1) % hashtags.length];
      const keyword = keywords[i % keywords.length];
      const author = creators[i % creators.length];
      const thumbFilename = localThumbs[i % localThumbs.length];

      candidates.push({
        platform: 'instagram',
        platformVideoId: id,
        canonicalUrl: `https://www.instagram.com/reel/${id}/`,
        thumbnailUrl: `/storage/thumbnails/${thumbFilename}`,
        mediaUrl: `https://video.example.com/mock/reels/${id}.mp4`,
        caption: `Obsessed with this! Real review of the ${keyword}. Check this out ${tag1} ${tag2} #viral #foryou`,
        author: `@${author}`,
        postedAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 4),
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
    // PROVIDER ORDER:
    // 1. Official Meta Graph API if token present
    if (this.token && this.token.trim() !== '') {
      logger.info('InstagramCollector: Using official Meta Graph API');
      return this.collectGraphApi(queries, targetCount);
    }

    // 2. Apify provider if Apify token present
    if (this.apifyClient.hasToken()) {
      logger.info({ actorId: this.actorId }, 'InstagramCollector: Using Apify data provider');
      return this.collectApify(queries, targetCount);
    }

    // 3. Neither available: Clear failure with honest shortfall
    logger.warn('InstagramCollector: No credentials found (neither INSTAGRAM_ACCESS_TOKEN nor APIFY_TOKEN)');
    return {
      source: 'instagram',
      requested: targetCount,
      collected: 0,
      usable: 0,
      shortfall: targetCount,
      candidates: [],
      error: 'Neither INSTAGRAM_ACCESS_TOKEN nor APIFY_TOKEN is configured in environment',
    };
  }

  /**
   * Official Meta Graph API collection path
   */
  private async collectGraphApi(queries: GeneratedQueries, targetCount: number): Promise<CollectorResult> {
    const candidates: RawVideoCandidate[] = [];
    const seenIds = new Set<string>();
    let lastError: string | undefined;
    let totalItemsFetched = 0;

    const hashtagsToSearch = queries.instagram.hashtags
      .map((h) => h.replace(/^#/, '').trim())
      .filter(Boolean);

    for (const tag of hashtagsToSearch) {
      if (candidates.length >= targetCount) break;

      try {
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

        const mediaUrl = `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?user_id=${userId}&fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&access_token=${this.token}`;
        const mediaRes = await safeFetch(mediaUrl, { timeoutMs: 8000 });

        if (mediaRes.statusCode === 200) {
          const mediaData = JSON.parse(mediaRes.text);
          const items = mediaData.data || [];

          for (const item of items) {
            if (item.media_type === 'VIDEO' && !seenIds.has(item.id)) {
              seenIds.add(item.id);

              let thumbUrl = item.thumbnail_url;
              if (thumbUrl) {
                const saved = await downloadAndSaveThumbnail(thumbUrl, 'instagram', item.id);
                if (saved) thumbUrl = saved.localUrl;
              }

              candidates.push({
                platform: 'instagram',
                platformVideoId: item.id,
                canonicalUrl: item.permalink || `https://www.instagram.com/reel/${item.id}/`,
                thumbnailUrl: thumbUrl,
                mediaUrl: item.media_url,
                caption: item.caption,
                author: item.username ? `@${item.username}` : undefined,
                postedAt: item.timestamp ? new Date(item.timestamp) : undefined,
                raw: { ...item, originalThumbnailUrl: item.thumbnail_url },
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
    const estimatedCostUsd = Number((totalItemsFetched * 0.0025).toFixed(4));

    logger.info(
      { source: 'instagram', totalItemsFetched, estimatedCostUsd },
      'Instagram collection cost reported'
    );

    return {
      source: 'instagram',
      requested: targetCount,
      collected: candidates.length,
      usable,
      shortfall,
      candidates,
      cost: {
        itemsFetched: totalItemsFetched,
        estimatedCostUsd,
      },
      error: shortfall > 0 && lastError ? lastError : undefined,
    };
  }

  /**
   * Apify Actor Provider collection path with caching, cost safety caps, and normalisation
   */
  private async collectApify(queries: GeneratedQueries, targetCount: number): Promise<CollectorResult> {
    const candidates: RawVideoCandidate[] = [];
    const seenIds = new Set<string>();
    let lastError: string | undefined;

    const maxItemsPerRun = parseInt(process.env.APIFY_MAX_ITEMS_PER_RUN || '40', 10);
    const maxRunsPerSearch = parseInt(process.env.APIFY_MAX_RUNS_PER_SEARCH || '3', 10);

    const hashtagsToSearch = queries.instagram.hashtags
      .map((h) => h.replace(/^#/, '').trim())
      .filter(Boolean);

    let runsCount = 0;
    let totalItemsFetched = 0;

    for (const tag of hashtagsToSearch) {
      if (candidates.length >= targetCount) break;
      if (runsCount >= maxRunsPerSearch) {
        logger.info(
          { runsCount, maxRunsPerSearch },
          'Reached maximum allowed Apify runs per search (cost safety cap)'
        );
        break;
      }

      const cacheKey = `apify:instagram:${tag.toLowerCase()}`;

      // 1. Check 24-hour database cache
      try {
        const cached = await this.cacheRepo.get<RawVideoCandidate[]>(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          logger.info({ tag, count: cached.length }, 'Using 24h cached Apify results for Instagram hashtag');
          for (const item of cached) {
            if (!seenIds.has(item.platformVideoId)) {
              seenIds.add(item.platformVideoId);
              candidates.push({
                ...item,
                postedAt: item.postedAt ? new Date(item.postedAt) : undefined,
              });
              if (candidates.length >= targetCount) break;
            }
          }
          continue;
        }
      } catch (cacheErr) {
        logger.warn({ cacheErr }, 'Cache lookup failed, proceeding to query Apify');
      }

      // 2. Execute Apify actor run
      runsCount++;
      try {
        const input = {
          hashtags: [tag],
          resultsType: 'reels',
          resultsLimit: Math.min(targetCount - candidates.length + 5, maxItemsPerRun),
        };

        const rawItems = await this.apifyClient.callActorSync(this.actorId, input, {
          timeoutSeconds: 60,
          maxItems: maxItemsPerRun,
        });

        logger.info({ tag, itemsReceived: rawItems.length }, 'Received dataset items from Apify Instagram actor');
        totalItemsFetched += rawItems.length;

        const tagCandidates: RawVideoCandidate[] = [];

        for (const item of rawItems) {
          // Normalisation:
          // A. Must have usable ID
          const rawId = item.id || item.shortCode;
          if (!rawId) continue;
          const id = String(rawId);

          if (seenIds.has(id)) continue;

          // B. Keep video items only (reject static single photos)
          const isVideo =
            item.type === 'Video' ||
            item.type === 'Reel' ||
            item.productType === 'clips' ||
            Boolean(item.videoUrl) ||
            Boolean(item.videoDuration);

          if (!isVideo) continue;

          // C. Must have a thumbnail
          const originalThumb =
            item.displayUrl ||
            item.thumbnailUrl ||
            (Array.isArray(item.images) && item.images[0]) ||
            undefined;

          if (!originalThumb) continue;

          // D. Download and cache thumbnail locally (max 800px)
          let finalThumbUrl = originalThumb;
          try {
            const saved = await downloadAndSaveThumbnail(originalThumb, 'instagram', id);
            if (saved) {
              finalThumbUrl = saved.localUrl;
            }
          } catch (thumbErr) {
            logger.warn({ thumbErr, id }, 'Could not save local thumbnail copy, retaining remote URL');
          }

          const candidate: RawVideoCandidate = {
            platform: 'instagram',
            platformVideoId: id,
            canonicalUrl: item.url || `https://www.instagram.com/reel/${item.shortCode || id}/`,
            thumbnailUrl: finalThumbUrl,
            mediaUrl: item.videoUrl || undefined,
            caption: item.caption || '',
            author: item.ownerUsername ? `@${item.ownerUsername}` : undefined,
            postedAt: item.timestamp ? new Date(item.timestamp) : undefined,
            raw: { ...item, originalThumbnailUrl: originalThumb },
            isMock: false,
          };

          seenIds.add(id);
          candidates.push(candidate);
          tagCandidates.push(candidate);

          if (candidates.length >= targetCount) break;
        }

        // Cache collected items for 24 hours (86,400s)
        if (tagCandidates.length > 0) {
          try {
            await this.cacheRepo.set(cacheKey, tagCandidates, 86400);
          } catch (cacheSetErr) {
            logger.warn({ cacheSetErr, tag }, 'Failed to persist tag results to cache');
          }
        }
      } catch (err: any) {
        lastError = err.message;
        logger.warn({ err: err.message, tag, actorId: this.actorId }, 'Apify Instagram collection failed');
      }
    }

    const usable = candidates.length;
    const shortfall = Math.max(0, targetCount - usable);
    const estimatedCostUsd = Number((totalItemsFetched * 0.0025).toFixed(4));

    logger.info(
      { source: 'instagram', totalItemsFetched, estimatedCostUsd },
      'Instagram collection cost reported'
    );

    return {
      source: 'instagram',
      requested: targetCount,
      collected: candidates.length,
      usable,
      shortfall,
      candidates,
      cost: {
        itemsFetched: totalItemsFetched,
        estimatedCostUsd,
      },
      error: shortfall > 0 && lastError ? lastError : undefined,
    };
  }
}
