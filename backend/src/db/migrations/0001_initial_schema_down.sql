-- 0001_initial_schema_down.sql
-- Down Migration for ViDashboard Phase 1 Schema

DROP TABLE IF EXISTS cache_entries CASCADE;
DROP TABLE IF EXISTS pipeline_events CASCADE;
DROP TABLE IF EXISTS source_runs CASCADE;
DROP TABLE IF EXISTS seen_videos CASCADE;
DROP TABLE IF EXISTS search_results CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS product_analyses CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS searches CASCADE;
