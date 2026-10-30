import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { closeDb } from '../src/db';
import { FastifyInstance } from 'fastify';

describe('Health Check API Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await ensurePostgresRunning();
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with database connected status and uptime', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('vidashboard-backend');
    expect(body.database).toBe('connected');
    expect(typeof body.uptime).toBe('number');
    expect(body.timestamp).toBeDefined();
    expect(body.mode).toBeDefined();
  });

  it('preserves or assigns an x-request-id header for tracing', async () => {
    const customRequestId = 'test-trace-id-12345';
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        'x-request-id': customRequestId,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe(customRequestId);
  });
});
