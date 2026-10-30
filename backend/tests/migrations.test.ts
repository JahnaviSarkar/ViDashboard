import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { runRollback } from '../src/db/rollback';
import { getPool, closeDb } from '../src/db';
import { ensurePostgresRunning } from '../src/db/embedded-helper';

describe('Database Migrations and Rollback System', () => {
  beforeAll(async () => {
    await ensurePostgresRunning();
  });

  afterAll(async () => {
    await runMigrations();
  });

  it('rolls back cleanly and verifies tables are dropped', async () => {
    const rolledBack = await runRollback();
    expect(rolledBack).toBe('0001_initial_schema');

    const pool = getPool();
    const res = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('searches', 'products', 'product_analyses', 'videos', 'search_results', 'seen_videos', 'source_runs', 'pipeline_events', 'cache_entries');
    `);

    expect(res.rows.length).toBe(0);
  });

  it('applies migrations onto fresh database and creates all 9 required tables', async () => {
    const applied = await runMigrations();
    expect(applied).toContain('0001_initial_schema');

    const pool = getPool();
    const res = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tableNames = res.rows.map((r: { table_name: string }) => r.table_name);
    const expectedTables = [
      'cache_entries',
      'pipeline_events',
      'product_analyses',
      'products',
      'schema_migrations',
      'search_results',
      'searches',
      'seen_videos',
      'source_runs',
      'videos',
    ];

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it('is idempotent when migrations are already applied', async () => {
    const appliedAgain = await runMigrations();
    expect(appliedAgain.length).toBe(0);
  });
});
