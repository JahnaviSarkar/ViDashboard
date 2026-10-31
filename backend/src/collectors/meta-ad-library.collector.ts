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

    const queryStr = [
      ...searchTerms,
      ...(queries.instagram?.keywords || []),
      ...(queries.instagram?.hashtags || []),
    ]
      .join(' ')
      .toLowerCase();

    const isToyOrWood =
      queryStr.includes('balance') ||
      queryStr.includes('board') ||
      queryStr.includes('wood') ||
      queryStr.includes('toy') ||
      queryStr.includes('montessori') ||
      queryStr.includes('waldorf') ||
      queryStr.includes('rocker') ||
      queryStr.includes('climb') ||
      queryStr.includes('sensory') ||
      queryStr.includes('toddler') ||
      queryStr.includes('kid');

    const toyMetaPool = [
      {
        pageName: 'Kinderfeets Active Play',
        caption: `Certified FSC European Beechwood: The Award-Winning Curved Balance Board.\n\nDesigned for active toddlers and growing kids. Supports up to 485 lbs. Use as a rocker, slide, bridge, or reading nook. Non-toxic water-based finish with optional felt backing. Shop now for 20% off!`,
      },
      {
        pageName: 'Wobbel Montessori Toys',
        caption: `Inspire Open-Ended Movement: The Original Curved Wooden Rocker.\n\nStimulates balance, physical strength, and boundless creativity. Handcrafted from sustainable pressed beechwood with natural child-safe lacquer. Free shipping on family starter sets today.`,
      },
      {
        pageName: 'Montessori Woodcraft Co.',
        caption: `Screen-Free Active Play For Indoors: Heavy Duty Wooden Balance Board.\n\nGive your toddler the joy of movement! Smooth chamfered edges, zero splinters, and tested to international child toy safety standards. Tap Shop Now to explore our natural wood collection.`,
      },
      {
        pageName: 'Bannor Heirloom Toys',
        caption: `Heirloom Quality Meets Active Learning: Handcrafted Curved Balance Rocker.\n\nInvest in toys that last generations. Crafted with premium birch plywood and organic beeswax finish. Promotes gross motor development and active sensory exploration. Order today!`,
      },
      {
        pageName: 'Little Climber & Rocker',
        caption: `Build Core Strength & Balance: The Ultimate Toddler Movement Board.\n\nRecommended by pediatric occupational therapists for balance and coordination. Sturdy curved arch with protective felt backing to safeguard hardwood floors. 30-Day Money-Back Guarantee.`,
      },
      {
        pageName: 'Waldorf Home Studio',
        caption: `Endless Imagination In A Single Curve: Wooden Rocker & Balance Board.\n\nIs it a bridge? A slide? A rocking cradle? Your child decides! 100% natural wood, eco-friendly waterborne glaze, and built for daily active play. Claim your seasonal discount now.`,
      },
      {
        pageName: 'Sprout Kids Active',
        caption: `Promote Physical Agility Indoors: Natural Curved Balance Board.\n\nRainy days don't have to mean screens. Our wooden rocker board burns energy and builds coordination. Holds adults up to 350 lbs too! Tap to shop the new natural wood edition.`,
      },
      {
        pageName: 'Sensory Play Essentials',
        caption: `Pediatric OT Approved: Sensory Balance Rocker Board For Kids.\n\nEnhance vestibular stimulation and proprioceptive feedback with gentle rocking and balancing. Safe, smooth, and sustainable beechwood construction. Explore the collection today.`,
      },
      {
        pageName: 'Modern Nursery Studio',
        caption: `Aesthetic Playroom Must-Have: Minimalist Wooden Balance Board.\n\nNeutral Scandinavian aesthetic meets heavy-duty toddler active play. Fits seamlessly into any modern nursery or living room. Rated 4.9/5 by over 3,000 Montessori parents.`,
      },
      {
        pageName: 'EcoWood Children',
        caption: `Sustainably Sourced Birch Rocker: Designed for Independent Play.\n\nNo plastic, no batteries, no overstimulation. Just natural curved birch wood and your child's imagination. Safe for ages 18 months and up. Tap Shop Now for holiday bundles.`,
      },
      {
        pageName: 'KinderMovement Gear',
        caption: `Develop Coordination Faster: Active Wooden Rocker & Balance Beam.\n\nHelp toddlers master gross-motor balance with our ergonomic curved wood board. Smooth curved contours protect little hands and feet. Fast 2-day delivery across the country.`,
      },
      {
        pageName: 'Heirloom Playroom Co.',
        caption: `Handcrafted Active Toys: Beechwood Rocker & Stepping Bridge.\n\nEngineered with 11 layers of pressed European beechwood. Extremely durable, smooth-sanded, and non-toxic. Tap Shop Now to upgrade your child's playroom.`,
      },
      {
        pageName: 'ActiveToddler Brand',
        caption: `Say Goodbye To Screen Meltdowns: Active Wooden Balance Board.\n\nKeep little ones engaged, moving, and practicing balance for hours. Works on carpet, tile, or hardwood. Certified ASTM and EN71 child toy safety compliant.`,
      },
      {
        pageName: 'Montessori Living Direct',
        caption: `Open-Ended Learning Starts Here: Curved Wood Balance Rocker.\n\nFoster independence and physical strength with the classic Waldorf curved board. Lightweight enough for kids to carry, sturdy enough for adults. Shop today's flash sale!`,
      },
      {
        pageName: 'Nordic Wood Toys',
        caption: `Timeless Scandinavian Craftsmanship: Natural Rocker Board.\n\nHandcrafted with love from sustainably harvested FSC birch. Beveled edges, warm natural grain, and non-slip felt underlayer. Explore all 6 wool felt colorways now.`,
      },
      {
        pageName: 'Playful Minds Kids',
        caption: `The Multi-Functional Toy Every Parent Recommends: Wooden Rocker Board.\n\nRocker, step stool, balancing beam, and lounge chair. Watch your child discover 100 ways to play. Join over 20,000 happy families who trust our wooden play gear.`,
      },
      {
        pageName: 'Little Explorers Studio',
        caption: `Safe, Sturdy, Child-Tested: Curved Balance Board with Felt.\n\nSmooth wood surface, rounded corners, and premium acoustic felt that prevents floor scratches. 100% satisfaction guaranteed with free returns.`,
      },
      {
        pageName: 'PureWood Parenting',
        caption: `Eco-Conscious Active Play: Natural Birch Balance Board.\n\nGive the gift of movement. Hand-finished with organic plant-based oils and child-safe sealant. Shop our best-selling wooden active toy today.`,
      },
      {
        pageName: 'Creative Toddler Gear',
        caption: `From Balance To Forts: The Most Versatile Toy In Your Home.\n\nEncourage active physical play and gross motor development without the plastic clutter. Tested up to 400 lbs. Tap to see why parents love our curved rocker board.`,
      },
      {
        pageName: 'Balance & Bloom Co.',
        caption: `Mindful Movement For Little Ones: The Original Wooden Rocker.\n\nSupport sensory development, core posture, and creative confidence. Crafted from 100% sustainably farmed beech. Tap Shop Now for exclusive introductory pricing.`,
      },
    ];

    const genericBrandPages = [
      `${brandTerm} Official`,
      `${brandTerm} Global Store`,
      `${brandTerm} Essentials`,
      'Top Tier Deals',
      'Modern Commerce Studio',
      'Verified Direct Offers',
      'Direct Deal Spot',
      'Global Brand Outlet',
    ];

    const genericHooks = [
      'Limited Time Exclusive: Experience the difference.',
      'Best Seller Spotlight: Designed for modern lifestyles.',
      'Unbeatable comfort and premium design. Shop now for 20% off!',
      'Back in stock by popular demand. Get yours before it sells out.',
      'Over 10,000 5-star reviews. Free shipping worldwide on orders today.',
    ];

    const localThumbs = [
      'meta_1041022068954000.jpg',
      'meta_1052230050775865.jpg',
      'meta_1118313677203787.jpg',
      'meta_1214014497539869.jpg',
      'meta_1241606678069376.jpg',
      'meta_1266637455530440.jpg',
      'meta_1309947944597670.jpg',
      'meta_1330472295881394.jpg',
      'meta_1397617041778492.jpg',
      'meta_1400357895434601.jpg',
      'meta_1421472709368733.jpg',
      'meta_1424753659352272.jpg',
      'meta_1437475274814783.jpg',
      'meta_1447815677084521.jpg',
      'meta_1450748213065627.jpg',
      'meta_1561399651530550.jpg',
      'meta_1571420414072622.jpg',
      'meta_1603869493985198.jpg',
      'meta_1619983686396810.jpg',
      'meta_1689889301694357.jpg',
    ];

    for (let i = 0; i < targetCount; i++) {
      const adId = `mock_meta_ad_${(i + 1).toString().padStart(3, '0')}`;
      const thumbFilename = localThumbs[i % localThumbs.length];

      if (isToyOrWood) {
        const item = toyMetaPool[i % toyMetaPool.length];
        candidates.push({
          platform: 'meta',
          platformVideoId: adId,
          canonicalUrl: `https://www.facebook.com/ads/library/?id=${adId}`,
          thumbnailUrl: `/storage/thumbnails/${thumbFilename}`,
          mediaUrl: `https://video.example.com/mock/ads/${adId}.mp4`,
          caption: item.caption,
          author: item.pageName,
          postedAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6),
          raw: {
            adId,
            pageName: item.pageName,
            publisherPlatforms: ['facebook', 'instagram', 'audience_network'],
            adCreationTime: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6).toISOString(),
            currency: 'USD',
            estimatedSpend: { lower: 250 * (i + 1), upper: 900 * (i + 1) },
          },
          isMock: true,
        });
      } else {
        const term = searchTerms[i % searchTerms.length];
        const pageName = genericBrandPages[i % genericBrandPages.length];
        const hook = genericHooks[i % genericHooks.length];

        candidates.push({
          platform: 'meta',
          platformVideoId: adId,
          canonicalUrl: `https://www.facebook.com/ads/library/?id=${adId}`,
          thumbnailUrl: `/storage/thumbnails/${thumbFilename}`,
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
