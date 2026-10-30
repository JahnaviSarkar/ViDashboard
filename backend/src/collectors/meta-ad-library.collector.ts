import { Collector, CollectorOptions, CollectorResult, RawVideoCandidate } from './types';
import { GeneratedQueries } from '../services/query-generator.service';
import { safeFetch } from '../utils/ssrf';
import { logger } from '../utils/logger';
import { ApifyClient } from '../providers/apify/client';
import { CacheRepository } from '../db/repositories/cache.repository';
import { downloadAndSaveThumbnail } from '../utils/thumbnail-storage';

export interface MetaAdLibraryCollectorConfig {
  token?: string;
  apifyToken?: string;
  actorId?: string;
  mode?: 'live' | 'mock';
  countries?: string[];
  apifyClient?: ApifyClient;
  cacheRepo?: CacheRepository;
}

/**
 * Sanitizes ad copy by treating any text containing template placeholders (/\{\{.*?\}\}/)
 * as missing. Falls back through available text sources, then to the advertiser page name.
 */
export function sanitizeMetaAdCaption(
  rawTexts: Array<string | undefined | null>,
  pageName: string
): string {
  const placeholderRegex = /\{\{.*?\}\}/;
  for (const t of rawTexts) {
    if (t && typeof t === 'string') {
      const trimmed = t.trim();
      if (trimmed && !placeholderRegex.test(trimmed)) {
        return trimmed;
      }
    }
  }
  if (pageName && typeof pageName === 'string' && !placeholderRegex.test(pageName)) {
    return pageName.trim();
  }
  return '';
}

export class MetaAdLibraryCollector implements Collector {
  readonly source = 'meta' as const;
  private token?: string;
  private mode: 'live' | 'mock';
  private countries: string[];
  private apifyClient: ApifyClient;
  private actorId: string;
  private cacheRepo: CacheRepository;

  constructor(config?: MetaAdLibraryCollectorConfig) {
    this.token = config?.token !== undefined ? config.token : process.env.META_ACCESS_TOKEN;
    this.mode = config?.mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
    this.countries = config?.countries || ['US', 'IN', 'GB'];
    this.apifyClient = config?.apifyClient || new ApifyClient(config?.apifyToken);
    this.actorId =
      config?.actorId ||
      process.env.APIFY_META_ADS_ACTOR ||
      'curious_coder/facebook-ads-library-scraper';
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
    const searchTerms = queries.meta.searchTerms.length > 0 ? queries.meta.searchTerms : ['Product Sale'];
    const brandTerm = searchTerms[0] || 'Brand';

    const brandPages = [
      `${brandTerm} Official`,
      `${brandTerm} Global Store`,
      `${brandTerm} Essentials`,
      'Top Tier Deals',
      'Modern Commerce Studio',
      'Verified Direct Offers',
      'Direct Deal Spot',
      'Global Brand Outlet',
    ];

    const hooks = [
      'Limited Time Exclusive: Experience the difference.',
      'Best Seller Spotlight: Designed for modern lifestyles.',
      'Unbeatable comfort and premium design. Shop now for 20% off!',
      'Back in stock by popular demand. Get yours before it sells out.',
      'Over 10,000 5-star reviews. Free shipping worldwide on orders today.',
    ];

    for (let i = 0; i < targetCount; i++) {
      const adId = `mock_meta_ad_${(i + 1).toString().padStart(3, '0')}`;
      const term = searchTerms[i % searchTerms.length];
      const pageName = brandPages[i % brandPages.length];
      const hook = hooks[i % hooks.length];

      candidates.push({
        platform: 'meta',
        platformVideoId: adId,
        canonicalUrl: `https://www.facebook.com/ads/library/?id=${adId}`,
        thumbnailUrl: `https://images.example.com/mock/ad_thumbs/${adId}.jpg`,
        mediaUrl: `https://video.example.com/mock/ads/${adId}.mp4`,
        caption: `${hook}\n\nDiscover the all-new ${term}. Tap Shop Now to claim the limited seasonal bundle.`,
        author: pageName,
        postedAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6),
        raw: {
          adId,
          pageName,
          publisherPlatforms: ['facebook', 'instagram', 'audience_network'],
          adCreationTime: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6).toISOString(),
          currency: 'USD',
          estimatedSpend: { lower: 100 * (i + 1), upper: 500 * (i + 1) },
        },
        isMock: true,
      });
    }

    return {
      source: 'meta',
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
      logger.info('MetaAdLibraryCollector: Using official Meta Graph API ads_archive');
      return this.collectGraphApi(queries, targetCount);
    }

    // 2. Apify provider if Apify token present
    if (this.apifyClient.hasToken()) {
      logger.info({ actorId: this.actorId }, 'MetaAdLibraryCollector: Using Apify data provider');
      return this.collectApify(queries, targetCount);
    }

    // 3. Neither available: Clear failure with honest shortfall
    logger.warn('MetaAdLibraryCollector: No credentials found (neither META_ACCESS_TOKEN nor APIFY_TOKEN)');
    return {
      source: 'meta',
      requested: targetCount,
      collected: 0,
      usable: 0,
      shortfall: targetCount,
      candidates: [],
      error: 'Neither META_ACCESS_TOKEN nor APIFY_TOKEN is configured in environment',
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

    const searchTerms = queries.meta.searchTerms.filter(Boolean);

    for (const term of searchTerms) {
      if (candidates.length >= targetCount) break;

      try {
        const countriesParam = JSON.stringify(this.countries);
        const fields = [
          'id',
          'ad_creation_time',
          'ad_creative_bodies',
          'ad_creative_link_captions',
          'ad_creative_link_titles',
          'ad_delivery_start_time',
          'ad_snapshot_url',
          'page_id',
          'page_name',
          'publisher_platforms',
        ].join(',');

        const url = `https://graph.facebook.com/v19.0/ads_archive?access_token=${this.token}&ad_reached_countries=${encodeURIComponent(
          countriesParam
        )}&ad_type=ALL&search_terms=${encodeURIComponent(term)}&ad_active_status=ALL&fields=${fields}&limit=25`;

        const res = await safeFetch(url, { timeoutMs: 10000 });
        if (res.statusCode !== 200) {
          const errBody = JSON.parse(res.text || '{}');
          lastError = errBody?.error?.message || `Ad Library query returned HTTP ${res.statusCode}`;
          logger.warn({ term, error: lastError }, 'Meta Ad Library API request returned non-200');
          continue;
        }

        const data = JSON.parse(res.text);
        const ads = data.data || [];

        for (const ad of ads) {
          if (!seenIds.has(ad.id)) {
            seenIds.add(ad.id);
            const caption =
              ad.ad_creative_bodies?.[0] ||
              ad.ad_creative_link_titles?.[0] ||
              ad.ad_creative_link_captions?.[0] ||
              '';

            candidates.push({
              platform: 'meta',
              platformVideoId: ad.id,
              canonicalUrl: ad.ad_snapshot_url || `https://www.facebook.com/ads/library/?id=${ad.id}`,
              thumbnailUrl: undefined,
              mediaUrl: ad.ad_snapshot_url,
              caption,
              author: ad.page_name,
              postedAt: ad.ad_creation_time ? new Date(ad.ad_creation_time) : undefined,
              raw: ad,
              isMock: false,
            });

            if (candidates.length >= targetCount) break;
          }
        }
      } catch (err: any) {
        lastError = err.message;
        logger.warn({ err, term }, 'Error executing Meta Ad Library collection');
      }
    }

    const usable = candidates.length;
    const shortfall = Math.max(0, targetCount - usable);
    const estimatedCostUsd = Number((totalItemsFetched * 0.00075).toFixed(4));

    logger.info(
      { source: 'meta', totalItemsFetched, estimatedCostUsd },
      'Meta Ad Library collection cost reported'
    );

    return {
      source: 'meta',
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

    const searchTerms = queries.meta.searchTerms.filter(Boolean);
    let runsCount = 0;
    let totalItemsFetched = 0;

    for (const term of searchTerms) {
      if (candidates.length >= targetCount) break;
      if (runsCount >= maxRunsPerSearch) {
        logger.info(
          { runsCount, maxRunsPerSearch },
          'Reached maximum allowed Apify runs per search (cost safety cap)'
        );
        break;
      }

      const cleanTerm = term.trim().toLowerCase();
      const cacheKey = `apify:meta:${cleanTerm}`;

      // 1. Check 24-hour database cache
      try {
        const cached = await this.cacheRepo.get<RawVideoCandidate[]>(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          logger.info({ term, count: cached.length }, 'Using 24h cached Apify results for Meta Ad Library');
          for (const item of cached) {
            if (!seenIds.has(item.platformVideoId)) {
              seenIds.add(item.platformVideoId);
              candidates.push(item);
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
        // Construct standard Meta Ad Library web search URL
        const adSearchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(
          term
        )}&search_type=keyword_unordered&media_type=all`;

        const requestCount = Math.max(10, Math.min(targetCount - candidates.length + 5, maxItemsPerRun));

        let input: Record<string, unknown>;
        if (this.actorId.includes('curious_coder')) {
          input = {
            urls: [{ url: adSearchUrl }],
            count: requestCount,
            limitPerSource: requestCount,
          };
        } else {
          input = {
            startUrls: [{ url: adSearchUrl }],
            maxAds: requestCount,
            activeStatus: 'active',
          };
        }

        const rawItems = await this.apifyClient.callActorSync(this.actorId, input, {
          timeoutSeconds: 60,
          maxItems: requestCount,
        });

        logger.info({ term, itemsReceived: rawItems.length }, 'Received dataset items from Apify Meta Ads actor');
        totalItemsFetched += rawItems.length;

        const termCandidates: RawVideoCandidate[] = [];

        for (const item of rawItems) {
          // Normalisation:
          // A. Must have usable ID
          const rawId = item.ad_archive_id || item.id || item.ad_id || item.collation_id;
          if (!rawId) continue;
          const id = String(rawId);

          if (seenIds.has(id)) continue;

          // B. Extract snapshot, cards, video URLs
          const snapshot = item.snapshot || {};
          const cards: any[] = Array.isArray(snapshot.cards) ? snapshot.cards : [];

          // Find video asset in cards or direct item properties
          let videoUrl: string | undefined;
          let previewImageUrl: string | undefined;
          let matchedCardBody: string | undefined;

          if (cards.length > 0) {
            for (const card of cards) {
              const cardVid = card.video_hd_url || card.video_sd_url;
              if (cardVid) {
                videoUrl = cardVid;
                previewImageUrl = card.video_preview_image_url;
                if (card.body) matchedCardBody = card.body;
                break;
              }
            }
          }

          if (!videoUrl) {
            videoUrl = item.videoUrl || (Array.isArray(item.videos) && item.videos[0]) || undefined;
          }

          // Video items only: Reject static image ads with no video URL
          if (!videoUrl) continue;

          // C. Must have a thumbnail
          const originalThumb =
            previewImageUrl ||
            snapshot.page_profile_picture_url ||
            item.imageUrl ||
            (Array.isArray(item.images) && item.images[0]) ||
            undefined;

          if (!originalThumb) continue;

          // D. Download and cache thumbnail locally (max 800px)
          let finalThumbUrl = originalThumb;
          try {
            const saved = await downloadAndSaveThumbnail(originalThumb, 'meta', id);
            if (saved) {
              finalThumbUrl = saved.localUrl;
            }
          } catch (thumbErr) {
            logger.warn({ thumbErr, id }, 'Could not save local thumbnail copy, retaining remote URL');
          }

          const pageName = item.page_name || snapshot.page_name || item.pageName || 'Advertiser';
          const canonicalUrl =
            item.ad_library_url ||
            `https://www.facebook.com/ads/library/?id=${id}`;

          // Sanitize ad copy: reject template placeholders ({{...}}), fall back to body, then page name
          const finalCaption = sanitizeMetaAdCaption(
            [matchedCardBody, snapshot.body?.text, item.adText, snapshot.caption],
            pageName
          );

          const candidate: RawVideoCandidate = {
            platform: 'meta',
            platformVideoId: id,
            canonicalUrl,
            thumbnailUrl: finalThumbUrl,
            mediaUrl: videoUrl,
            caption: finalCaption,
            author: pageName,
            postedAt: item.start_date ? new Date(item.start_date) : undefined,
            raw: { ...item, originalThumbnailUrl: originalThumb },
            isMock: false,
          };

          seenIds.add(id);
          candidates.push(candidate);
          termCandidates.push(candidate);

          if (candidates.length >= targetCount) break;
        }

        // Cache collected items for 24 hours (86,400s)
        if (termCandidates.length > 0) {
          try {
            await this.cacheRepo.set(cacheKey, termCandidates, 86400);
          } catch (cacheSetErr) {
            logger.warn({ cacheSetErr, term }, 'Failed to persist term results to cache');
          }
        }
      } catch (err: any) {
        lastError = err.message;
        logger.warn({ err: err.message, term, actorId: this.actorId }, 'Apify Meta Ads collection failed');
      }
    }

    const usable = candidates.length;
    const shortfall = Math.max(0, targetCount - usable);
    const estimatedCostUsd = Number((totalItemsFetched * 0.00075).toFixed(4));

    logger.info(
      { source: 'meta', totalItemsFetched, estimatedCostUsd },
      'Meta Ad Library collection cost reported'
    );

    return {
      source: 'meta',
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
