import PgBoss from 'pg-boss';
import { getConfig } from '../config/env';
import { logger } from '../utils/logger';
import { PipelineOrchestratorService } from '../services/pipeline-orchestrator.service';

export const SEARCH_PIPELINE_QUEUE = 'search-pipeline';

let bossInstance: PgBoss | null = null;
const orchestrator = new PipelineOrchestratorService();

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

  // Register search-pipeline worker handler
  await bossInstance.work<{ searchId: string }>(SEARCH_PIPELINE_QUEUE, async (jobs) => {
    logger.info({ count: jobs.length }, 'search-pipeline worker received jobs');
    for (const job of jobs) {
      const searchId = job.data?.searchId;
      if (!searchId) {
        logger.warn({ jobId: job.id }, 'Job missing searchId payload, skipping');
        continue;
      }
      try {
        await orchestrator.execute(searchId);
      } catch (err) {
        logger.error({ err, searchId, jobId: job.id }, 'Error executing pipeline job in worker');
      }
    }
  });

  logger.info({ queue: SEARCH_PIPELINE_QUEUE }, 'Registered search-pipeline queue worker');
  return bossInstance;
}

export async function enqueueSearchPipelineJob(data: { searchId: string }): Promise<string | null> {
  const boss = getBoss();
  const result = await boss.send(SEARCH_PIPELINE_QUEUE, data);
  const jobId = typeof result === 'string' ? result : (result as any)?.id || (result ? String(result) : null);
  logger.info({ searchId: data.searchId, jobId }, 'Enqueued search pipeline job');
  return jobId;
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
