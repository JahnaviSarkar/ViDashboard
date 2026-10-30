# ViDashboard - Data Sources & Collectors Architecture

## 1. Overview & Strategy

ViDashboard discovers, aggregates, and analyzes short-form video content related to a specific product or concept across major social and advertising platforms:
1. **Instagram Reels** (Official Meta Graph API or Apify Instagram Reels Scraper)
2. **Meta Ad Library** (Official Meta Graph API `ads_archive` or Apify Facebook Ads Library Scraper)
3. **TikTok** (Optional supplementary discovery via official API or proxy)

### Collection Objectives
- **Target Yield**: Target of **20 raw candidate videos** per primary source per search run.
- **Provider Fallback Order**:
  1. **Official Graph API**: Used if `INSTAGRAM_ACCESS_TOKEN` / `META_ACCESS_TOKEN` is present in the environment.
  2. **Apify Provider Layer**: Transparent fallback used if `APIFY_TOKEN` is present.
  3. **Explicit Shortfall Accounting**: If neither token is present or quotas/platforms yield fewer than 20 videos, the system logs the exact shortfall and error without fabricating synthetic data.
  4. **Mock Provider**: Exclusively used when `MODE=mock` (all candidate records labeled with `isMock: true`).
- **Parallel Isolation**: All collectors run concurrently via `Promise.allSettled` to prevent slow or failing external APIs from halting the pipeline.
- **Shortfall Accounting**: Every run explicitly tracks `requested`, `collected`, `usable`, `shortfall`, and `error` in the `source_runs` table.

---

## 2. Data Provider Layer (Apify)

Due to Meta Graph API platform barriers (commercial ads in the Meta Ad Library Graph API are restricted to political/issue ads in regions like India and return no direct video files; Instagram hashtag endpoints require Business account linking and have a 30-hashtag 7-day rolling quota), ViDashboard integrates a managed Apify provider layer behind the unified `Collector` interface.

### 2.1 Instagram Reels Actor Choice & Justification

| Metric / Attribute | Specification |
| :--- | :--- |
| **Actor ID** | `apify/instagram-hashtag-scraper` (Configurable via `APIFY_INSTAGRAM_ACTOR`) |
| **Cost** | ~$2.30 to $2.60 per 1,000 results ($0.0023–$0.0026 per item) |
| **Speed** | ~4 to 7 seconds per 25-item run |
| **Mode** | `resultsType: 'reels'` |
| **Fields Returned** | `id`, `shortCode`, `type` (`"Video"`), `productType` (`"clips"`), `url`, `displayUrl` (thumbnail), `videoUrl` (.mp4 stream), `caption`, `hashtags`, `ownerUsername`, `ownerFullName`, `timestamp`, `videoDuration`, `videoPlayCount` |
| **Justification** | Official, maintained Apify scraper. By selecting `resultsType: 'reels'`, the actor directly queries Instagram Reels rather than feed images or carousels, ensuring 100% of returned items are true video candidates. |

### 2.2 Meta Ad Library Actor Choice & Justification

| Metric / Attribute | Specification |
| :--- | :--- |
| **Actor ID** | `curious_coder/facebook-ads-library-scraper` (Configurable via `APIFY_META_ADS_ACTOR`) |
| **Cost** | ~$0.75 per 1,000 ads ($0.00075 per item; minimum 10 items / run) |
| **Speed** | ~6 to 12 seconds per 25-ad batch |
| **Fields Returned** | `ad_archive_id` / `id`, `page_name`, `snapshot.body.text` (ad copy), `snapshot.cards[].video_hd_url`, `snapshot.cards[].video_sd_url`, `snapshot.cards[].video_preview_image_url`, `ad_library_url`, `start_date`, `publisher_platforms` |
| **Justification** | Fully scrapes active commercial video ad campaigns worldwide without requiring verified political advertiser credentials or Graph API app review. Extracts HD MP4 video streams and high-resolution cover preview frames from ad snapshot cards. |

---

## 3. Cost Safety, Caching & Reliability Architecture

```
[Query Generator]
       │
       ▼
[Collector Service] ───► Check 24-Hour DB Cache (Key: apify:{source}:{term})
       │                                  │
       │ Cache Miss                       │ Cache Hit
       ▼                                  ▼
[Cap Checks] (runsCount < APIFY_MAX_RUNS_PER_SEARCH)  Return Cached Candidates (0 cost)
       │
       ▼
[Apify Client]
  ├── Circuit Breaker (3 consecutive failures -> 30s OPEN state)
  ├── Retry with Backoff (HTTP 429 rate limit / 503)
  ├── Quota Protection (HTTP 402 -> APIFY_QUOTA_EXCEEDED)
  └── Timeout Protection (60s actor run ceiling)
       │
       ▼
[Normalisation & Asset Ingestion]
  ├── Video Filter (Keep video items only; reject static images)
  ├── Usable ID & Thumbnail Verification
  └── Download Thumbnail -> /storage/thumbnails/{platform}_{id}.jpg
       │
       ▼
[Database Persistence] ───► source_runs (requested, collected, usable, shortfall)
```

### 3.1 Cost Safety Caps
To prevent runaway actor execution or billing overruns:
- `APIFY_MAX_ITEMS_PER_RUN` (Default: `40`): Caps items scraped per actor run.
- `APIFY_MAX_RUNS_PER_SEARCH` (Default: `3`): Maximum query iterations per search. When reaching 3 runs, the collector stops and truthfully returns the collected count and shortfall.

### 3.2 24-Hour PostgreSQL Query Cache
All collector responses are cached in the PostgreSQL `cache` table:
- **Key Pattern**: `apify:instagram:{hashtag}` and `apify:meta:{search_term}`
- **TTL**: 86,400 seconds (24 hours).
- Subsequent discovery runs for identical or overlapping concepts are served instantly from cache at \$0 cost.

### 3.3 Thumbnail Asset Persistence
Instagram and Meta CDN thumbnail URLs contain time-limited authentication tokens (`?oh=...&oe=...`) that expire within hours or days.
- During collection, `downloadAndSaveThumbnail` retrieves the remote image, validates content length and dimensions (max 800px), and stores it permanently in `storage/thumbnails/{platform}_{id}.jpg`.
- Images are served to the frontend dashboard via Fastify route `/storage/thumbnails/:filename`.
- Local storage directories (`storage/`, `backend/storage/`) are strictly gitignored.

---

## 4. Collector Data Contracts

### 4.1 RawVideoCandidate Contract
```typescript
export interface RawVideoCandidate {
  platform: 'instagram' | 'meta' | 'tiktok';
  platformVideoId: string;
  canonicalUrl: string;
  thumbnailUrl?: string; // Local /storage/thumbnails/... or valid remote fallback
  mediaUrl?: string;     // Direct .mp4 video stream URL
  caption?: string;      // Post caption or ad copy
  author?: string;       // @username or advertiser page name
  postedAt?: Date;       // Publication timestamp
  raw?: Record<string, unknown>;
  isMock: boolean;       // false for real collected data; true only in MODE=mock
}
```

### 4.2 CollectorResult Contract
```typescript
export interface CollectorResult {
  source: 'instagram' | 'meta' | 'tiktok';
  requested: number;
  collected: number;
  usable: number;
  shortfall: number;
  candidates: RawVideoCandidate[];
  error?: string;
}
```

---

## 5. Shortfall Recovery Protocol

If any collector returns `collected < 20`:
1. **Tier 1 (Exact)**: Check primary brand and exact product keywords.
2. **Tier 2 (Attribute Broadened)**: Broaden to dominant colors, materials, and shapes.
3. **Tier 3 (Category Discovery)**: Fall back to category-level high-traffic terms.
4. **Cap Enforcement**: If all query tiers are checked or `APIFY_MAX_RUNS_PER_SEARCH` is reached, the pipeline persists the usable videos and records the truthful shortfall in `source_runs`.
