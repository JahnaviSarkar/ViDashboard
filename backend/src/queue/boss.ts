import PgBoss from 'pg-boss';
import { getConfig } from '../config/env';
import { logger } from '../utils/logger';

export const SEARCH_PIPELINE_QUEUE = 'search-pipeline';

let bossInstance: PgBoss | null = null;

export async function initBoss(connectionString?: string): Promise<PgBoss> {
  if (bossInstance) {
    return bossInstance;
  }

  const config = getConfig();
  const connStr = connectionString || config.DATABASE_URL;

  bossInstance = new PgBoss({
    connectionString: connStr,
    schema: config.PG_BOSS_SCHEMA || 'pgboss',
    archiveFailedAfterSeconds: 7 * 86400,
    deleteAfterDays: 30,
  });

  bossInstance.on('error', (err) => {
    logger.error({ err }, 'pg-boss queue system error');
  });

  await bossInstance.start();
  logger.info({ schema: config.PG_BOSS_SCHEMA }, 'pg-boss job queue system initialized and started');

  // Register search-pipeline queue in pg-boss schema
  await bossInstance.createQueue(SEARCH_PIPELINE_QUEUE);

  // Register empty search-pipeline worker handler for Phase 1
  await bossInstance.work(SEARCH_PIPELINE_QUEUE, async (jobs) => {
    logger.info({ count: jobs.length }, 'search-pipeline worker received jobs');
    for (const job of jobs) {
      logger.info({ jobId: job.id, data: job.data }, 'Processing search-pipeline queue item (Phase 1 placeholder)');
    }
  });

  logger.info({ queue: SEARCH_PIPELINE_QUEUE }, 'Registered empty search-pipeline queue worker');
  return bossInstance;
}

export function getBoss(): PgBoss {
  if (!bossInstance) {
    throw new Error('pg-boss has not been initialized. Call initBoss() first.');
  }
  return bossInstance;
}

export async function stopBoss(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop({ graceful: true, timeout: 5000 });
    bossInstance = null;
    logger.info('pg-boss job queue stopped');
  }
}
