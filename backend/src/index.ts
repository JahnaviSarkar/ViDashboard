import { buildApp } from './app';
import { getConfig } from './config/env';
import { logger } from './utils/logger';
import { getPool, closeDb } from './db';
import { ensurePostgresRunning } from './db/embedded-helper';
import { initBoss, stopBoss } from './queue/boss';

async function main() {
  const config = getConfig();

  logger.info({ mode: config.MODE, port: config.PORT }, 'Starting ViDashboard Backend Server...');

  // Ensure database server is running
  await ensurePostgresRunning();

  // Verify database connectivity
  try {
    const pool = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1;');
    client.release();
    logger.info('Database connection verified successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database on startup');
    process.exit(1);
  }

  // Initialize pg-boss queue
  try {
    await initBoss();
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize pg-boss queue on startup (will retry or run without background queue)');
  }

  // Build and start Fastify app
  const app = buildApp();

  try {
    const address = await app.listen({ port: config.PORT, host: config.HOST });
    logger.info({ address }, `ViDashboard server listening at ${address}`);
  } catch (err) {
    logger.error({ err }, 'Error starting Fastify server');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received termination signal, shutting down gracefully...');
    try {
      await app.close();
      await stopBoss();
      await closeDb();
      logger.info('All resources closed cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error during server startup');
  process.exit(1);
});
