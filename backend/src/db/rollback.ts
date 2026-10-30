import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getPool, closeDb } from './index';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runRollback(customPool?: pg.Pool): Promise<string | null> {
  const pool = customPool || getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Get latest applied migration
    const res = await client.query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;');
    if (res.rows.length === 0) {
      logger.info('No migrations to roll back');
      await client.query('COMMIT');
      return null;
    }

    const latestVersion = res.rows[0].version;
    const migrationsDir = path.resolve(__dirname, 'migrations');
    const downFile = `${latestVersion}_down.sql`;
    const downFilePath = path.join(migrationsDir, downFile);

    if (!fs.existsSync(downFilePath)) {
      throw new Error(`Rollback file not found: ${downFilePath}`);
    }

    logger.info({ latestVersion, downFile }, `Rolling back migration ${latestVersion}`);
    const sql = fs.readFileSync(downFilePath, 'utf-8');

    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1;', [latestVersion]);

    await client.query('COMMIT');
    logger.info({ latestVersion }, `Successfully rolled back migration ${latestVersion}`);
    return latestVersion;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Rollback failed, transaction rolled back');
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('rollback.ts')) {
  import('./embedded-helper').then(async ({ ensurePostgresRunning }) => {
    try {
      await ensurePostgresRunning();
      const rolledBack = await runRollback();
      logger.info({ rolledBack }, 'Rollback operation completed');
      await closeDb();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Rollback failed');
      process.exit(1);
    }
  });
}
