-- 0001_initial_schema.sql
-- Up Migration for ViDashboard Phase 1 Schema

CREATE TABLE IF NOT EXISTS searches (
  id VARCHAR(36) PRIMARY KEY,
  input_type VARCHAR(32) NOT NULL,
  query_text TEXT,
  product_url TEXT,
  uploaded_image_path TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  selected_sources JSONB NOT NULL,
  min_match_threshold INTEGER NOT NULL DEFAULT 60,
  mode VARCHAR(16) NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  search_id VARCHAR(36) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  image_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS product_analyses (
  id VARCHAR(36) PRIMARY KEY,
  image_hash TEXT NOT NULL UNIQUE,
  attributes JSONB NOT NULL,
  queries JSONB NOT NULL,
  hashtags JSONB NOT NULL,
  provider VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(36) PRIMARY KEY,
  platform VARCHAR(32) NOT NULL,
  platform_video_id VARCHAR(255) NOT NULL,
  canonical_url TEXT NOT NULL,
  thumbnail_url TEXT,
  media_url TEXT,
  caption TEXT,
  author VARCHAR(255),
  posted_at TIMESTAMPTZ,
  media_phash VARCHAR(64),
  embedding REAL[],
  raw JSONB DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT videos_platform_platform_video_id_unique UNIQUE (platform, platform_video_id)
);

CREATE INDEX IF NOT EXISTS videos_media_phash_idx ON videos(media_phash);

CREATE TABLE IF NOT EXISTS search_results (
  id VARCHAR(36) PRIMARY KEY,
  search_id VARCHAR(36) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  video_id VARCHAR(36) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  match_score REAL NOT NULL,
  score_breakdown JSONB NOT NULL,
  explanation TEXT,
  below_threshold BOOLEAN NOT NULL DEFAULT FALSE,
  previously_seen BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of VARCHAR(36),
  rank INTEGER
);

CREATE INDEX IF NOT EXISTS search_results_search_id_idx ON search_results(search_id);
CREATE INDEX IF NOT EXISTS search_results_video_id_idx ON search_results(video_id);

CREATE TABLE IF NOT EXISTS seen_videos (
  video_id VARCHAR(36) PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  first_search_id VARCHAR(36) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  times_returned INTEGER NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_runs (
  id VARCHAR(36) PRIMARY KEY,
  search_id VARCHAR(36) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  source VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  requested INTEGER NOT NULL DEFAULT 20,
  collected INTEGER NOT NULL DEFAULT 0,
  usable INTEGER NOT NULL DEFAULT 0,
  shortfall INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS source_runs_search_id_idx ON source_runs(search_id);

CREATE TABLE IF NOT EXISTS pipeline_events (
  id SERIAL PRIMARY KEY,
  search_id VARCHAR(36) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  stage VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pipeline_events_search_id_id_idx ON pipeline_events(search_id, id);

CREATE TABLE IF NOT EXISTS cache_entries (
  key VARCHAR(512) PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ
);
