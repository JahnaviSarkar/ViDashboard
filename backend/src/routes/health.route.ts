import { FastifyInstance } from 'fastify';
import { getPool } from '../db';
import { getConfig } from '../config/env';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (_request, reply) => {
    let dbStatus = 'disconnected';
    try {
      const pool = getPool();
      await pool.query('SELECT 1;');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    const config = getConfig();

    return reply.status(200).send({
      status: 'ok',
      service: 'vidashboard-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      mode: config.MODE,
    });
  });
}
