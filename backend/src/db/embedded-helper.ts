import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDataDir = path.resolve(__dirname, '../../../data/postgres-data');

let embeddedServer: any = null;

export async function ensurePostgresRunning(preferredPort: number = 5432): Promise<string> {
  const defaultUrl = process.env.DATABASE_URL || `postgresql://postgres:postgres@localhost:${preferredPort}/vidashboard`;

  // 1. First test if an existing PostgreSQL instance is reachable
  const testClient = new pg.Client({
    connectionString: defaultUrl,
    connectionTimeoutMillis: 1000,
  });

  try {
    await testClient.connect();
    await testClient.query('SELECT 1;');
    await testClient.end();
    logger.info({ url: defaultUrl }, 'Connected to existing PostgreSQL server');
    return defaultUrl;
  } catch {
    logger.info('No external PostgreSQL reachable at default URL. Starting embedded PostgreSQL server...');
  }

  // 2. Start embedded postgres
  if (!embeddedServer) {
    const port = preferredPort;
    const databaseDir = workspaceDataDir;

    embeddedServer = new EmbeddedPostgres({
      databaseDir,
      port,
      user: 'postgres',
      password: 'postgres',
      persistent: true,
      onLog: () => {},
      onError: () => {},
    });

    const isInitialized = fs.existsSync(databaseDir) && fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
    if (!isInitialized) {
      fs.mkdirSync(databaseDir, { recursive: true });
      await embeddedServer.initialise();
    }

    try {
      await embeddedServer.start();
      logger.info({ port, databaseDir }, 'Embedded PostgreSQL started successfully');
    } catch (err: any) {
      const errMsg = err?.message || String(err || '');
      if (errMsg.includes(`${port}`)) {
        logger.warn(`Port ${port} in use, trying embedded PostgreSQL on port ${port + 1}`);
        return ensurePostgresRunning(port + 1);
      }
      throw err;
    }

    // Ensure 'vidashboard' database exists
    try {
      await embeddedServer.createDatabase('vidashboard');
      logger.info('Database "vidashboard" created in embedded PostgreSQL');
    } catch {
      // Database might already exist
    }

    const connectionString = `postgresql://postgres:postgres@localhost:${port}/vidashboard`;
    process.env.DATABASE_URL = connectionString;
    return connectionString;
  }

  return process.env.DATABASE_URL || defaultUrl;
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (embeddedServer) {
    try {
      await embeddedServer.stop();
      embeddedServer = null;
      logger.info('Embedded PostgreSQL stopped');
    } catch (err) {
      logger.error({ err }, 'Error stopping embedded PostgreSQL');
    }
  }
}
