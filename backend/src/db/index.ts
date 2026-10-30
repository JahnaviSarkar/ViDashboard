import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { getConfig } from '../config/env';
import { logger } from '../utils/logger';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getPool(connectionString?: string): pg.Pool {
  if (!pool) {
    let connStr = connectionString || getConfig().DATABASE_URL;
    if (!connStr.includes('client_encoding')) {
      const separator = connStr.includes('?') ? '&' : '?';
      connStr = `${connStr}${separator}options=-c%20client_encoding%3DUTF8`;
    }

    pool = new Pool({
      connectionString: connStr,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle PostgreSQL pool client');
    });
  }
  return pool;
}

export function getDb(customPool?: pg.Pool): NodePgDatabase<typeof schema> {
  if (customPool) {
    return drizzle(customPool, { schema });
  }
  if (!dbInstance) {
    const p = getPool();
    dbInstance = drizzle(p, { schema });
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
    logger.info('Database connection pool closed');
  }
}

export { schema };
