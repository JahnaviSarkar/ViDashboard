import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { initBoss, stopBoss, getBoss, SEARCH_PIPELINE_QUEUE } from '../src/queue/boss';
import { closeDb } from '../src/db';

describe('Job Queue (pg-boss) Infrastructure', () => {
  beforeAll(async () => {
    await ensurePostgresRunning();
    await initBoss();
  });

  afterAll(async () => {
    await stopBoss();
  });

  it('initializes pg-boss and provides active instance', () => {
    const boss = getBoss();
    expect(boss).toBeDefined();
  });

  it('successfully enqueues a job into search-pipeline queue', async () => {
    const boss = getBoss();
    const result = await boss.send(SEARCH_PIPELINE_QUEUE, {
      testSearchId: 'search_test_123',
      action: 'pipeline_init',
    });

    expect(result).toBeDefined();
    const id = typeof result === 'string' ? result : (result as any)?.id || (result ? String(result) : null);
    expect(id).toBeTruthy();
  });
});
