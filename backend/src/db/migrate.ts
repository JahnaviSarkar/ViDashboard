import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getPool, closeDb } from './index';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(customPool?: pg.Pool): Promise<string[]> {
  const pool = customPool || getPool();
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query('BEGIN');

    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const appliedVersions = new Set(res.rows.map((r: { version: string }) => r.version));

    // Find migration files in migrations dir
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory does not exist: ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql') && !file.endsWith('_down.sql'))
      .sort();

    for (const file of files) {
      const version = file.replace('.sql', '');
      if (!appliedVersions.has(version)) {
        logger.info({ version, file }, `Applying migration ${version}`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1);', [version]);
        applied.push(version);
        logger.info({ version }, `Successfully applied migration ${version}`);
      }
    }

    await client.query('COMMIT');
    return applied;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Migration failed, transaction rolled back');
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  import('./embedded-helper').then(async ({ ensurePostgresRunning }) => {
    try {
      await ensurePostgresRunning();
      const applied = await runMigrations();
      logger.info({ count: applied.length, applied }, 'Migrations completed successfully');
      await closeDb();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    }
  });
}
