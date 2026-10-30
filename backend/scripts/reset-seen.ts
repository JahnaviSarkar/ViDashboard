import { getPool, closeDb } from '../src/db';
import { ensurePostgresRunning, stopEmbeddedPostgres } from '../src/db/embedded-helper';
import { logger } from '../src/utils/logger';

export async function resetSeenDatabase(): Promise<void> {
  await ensurePostgresRunning();
  const pool = getPool();
  await pool.query('TRUNCATE TABLE search_results CASCADE;');
  await pool.query('TRUNCATE TABLE seen_videos CASCADE;');
  logger.info('Successfully truncated seen_videos and search_results tables.');
  await closeDb();
  await stopEmbeddedPostgres();
}

if (process.argv[1]?.includes('reset-seen')) {
  resetSeenDatabase()
    .then(() => {
      console.log('✅ Successfully reset seen_videos and search_results tables.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed to reset seen tables:', err);
      process.exit(1);
    });
}

