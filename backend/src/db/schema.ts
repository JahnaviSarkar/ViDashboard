import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  serial,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// 1. Searches table
export const searches = pgTable('searches', {
  id: varchar('id', { length: 36 }).primaryKey(),
  inputType: varchar('input_type', { length: 32 }).notNull(), // 'keyword' | 'product_url' | 'image_upload'
  queryText: text('query_text'),
  productUrl: text('product_url'),
  uploadedImagePath: text('uploaded_image_path'),
  status: varchar('status', { length: 32 }).notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  selectedSources: jsonb('selected_sources').$type<string[]>().notNull(),
  minMatchThreshold: integer('min_match_threshold').notNull().default(60),
  mode: varchar('mode', { length: 16 }).notNull().default('live'), // 'live' | 'mock'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// 2. Products table
export const products = pgTable('products', {
  id: varchar('id', { length: 36 }).primaryKey(),
  searchId: varchar('search_id', { length: 36 })
    .notNull()
    .references(() => searches.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  imageHash: text('image_hash'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
});

// 3. Product Analyses table (cached by image_hash)
export const productAnalyses = pgTable('product_analyses', {
  id: varchar('id', { length: 36 }).primaryKey(),
  imageHash: text('image_hash').notNull().unique(),
  attributes: jsonb('attributes').$type<Record<string, any>>().notNull(),
  queries: jsonb('queries').$type<Record<string, any>>().notNull(),
  hashtags: jsonb('hashtags').$type<string[] | Record<string, any>>().notNull(),
  provider: varchar('provider', { length: 32 }).notNull(), // 'gemini' | 'mock'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. Videos table
export const videos = pgTable(
  'videos',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    platform: varchar('platform', { length: 32 }).notNull(), // 'instagram' | 'meta' | 'tiktok'
    platformVideoId: varchar('platform_video_id', { length: 255 }).notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    mediaUrl: text('media_url'),
    caption: text('caption'),
    author: varchar('author', { length: 255 }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    mediaPhash: varchar('media_phash', { length: 64 }),
    embedding: real('embedding').array(),
    raw: jsonb('raw').$type<Record<string, unknown>>().default({}),
    isMock: boolean('is_mock').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('videos_platform_video_id_unique').on(table.platform, table.platformVideoId),
    index('videos_media_phash_idx').on(table.mediaPhash),
  ]
);

// 5. Search Results table
export const searchResults = pgTable(
  'search_results',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    searchId: varchar('search_id', { length: 36 })
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    videoId: varchar('video_id', { length: 36 })
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    matchScore: real('match_score').notNull(),
    scoreBreakdown: jsonb('score_breakdown').$type<Record<string, unknown>>().notNull(),
    explanation: text('explanation'),
    belowThreshold: boolean('below_threshold').notNull().default(false),
    previouslySeen: boolean('previously_seen').notNull().default(false),
    duplicateOf: varchar('duplicate_of', { length: 36 }),
    rank: integer('rank'),
  },
  (table) => [
    index('search_results_search_id_idx').on(table.searchId),
    index('search_results_video_id_idx').on(table.videoId),
  ]
);

// 6. Seen Videos table (deduplication across searches)
export const seenVideos = pgTable('seen_videos', {
  videoId: varchar('video_id', { length: 36 })
    .primaryKey()
    .references(() => videos.id, { onDelete: 'cascade' }),
  firstSearchId: varchar('first_search_id', { length: 36 })
    .notNull()
    .references(() => searches.id, { onDelete: 'cascade' }),
  timesReturned: integer('times_returned').notNull().default(1),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

// 7. Source Runs table
export const sourceRuns = pgTable(
  'source_runs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    searchId: varchar('search_id', { length: 36 })
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 32 }).notNull(), // 'instagram' | 'meta' | 'tiktok'
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    requested: integer('requested').notNull().default(20),
    collected: integer('collected').notNull().default(0),
    usable: integer('usable').notNull().default(0),
    shortfall: integer('shortfall').notNull().default(0),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('source_runs_search_id_idx').on(table.searchId),
  ]
);

// 8. Pipeline Events table (supports SSE replay with Last-Event-ID)
export const pipelineEvents = pgTable(
  'pipeline_events',
  {
    id: serial('id').primaryKey(),
    searchId: varchar('search_id', { length: 36 })
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    stage: varchar('stage', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(), // 'pending' | 'running' | 'done' | 'failed' | 'skipped'
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pipeline_events_search_id_id_idx').on(table.searchId, table.id),
  ]
);

// 9. Cache Entries table
export const cacheEntries = pgTable('cache_entries', {
  key: varchar('key', { length: 512 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});
