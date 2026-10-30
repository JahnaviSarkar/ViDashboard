import { beforeAll, afterAll } from 'vitest';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { closeDb } from '../src/db';
import { stopBoss } from '../src/queue/boss';

beforeAll(async () => {
  await ensurePostgresRunning();
  await runMigrations();
});

afterAll(async () => {
  await stopBoss();
  await closeDb();
});
