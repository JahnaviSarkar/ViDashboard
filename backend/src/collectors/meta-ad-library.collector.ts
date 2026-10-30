import { Collector, CollectorOptions, CollectorResult, RawVideoCandidate } from './types';
import { GeneratedQueries } from '../services/query-generator.service';
import { safeFetch } from '../utils/ssrf';
import { logger } from '../utils/logger';

export interface MetaAdLibraryCollectorConfig {
  token?: string;
  mode?: 'live' | 'mock';
  countries?: string[];
}

export class MetaAdLibraryCollector implements Collector {
  readonly source = 'meta' as const;
  private token?: string;
  private mode: 'live' | 'mock';
  private countries: string[];

  constructor(config?: MetaAdLibraryCollectorConfig) {
    this.token = config?.token || process.env.META_ACCESS_TOKEN;
    this.mode = config?.mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
    this.countries = config?.countries || ['US', 'IN', 'GB'];
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
    if (!this.token || this.token.trim() === '') {
      logger.warn('MetaAdLibraryCollector: META_ACCESS_TOKEN not configured in live mode');
      return {
        source: 'meta',
        requested: targetCount,
        collected: 0,
        usable: 0,
        shortfall: targetCount,
        candidates: [],
        error: 'META_ACCESS_TOKEN is not configured in environment',
      };
    }

    const candidates: RawVideoCandidate[] = [];
    const seenIds = new Set<string>();
    let lastError: string | undefined;

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

    return {
      source: 'meta',
      requested: targetCount,
      collected: candidates.length,
      usable,
      shortfall,
      candidates,
      error: shortfall > 0 && lastError ? lastError : undefined,
    };
  }
}
