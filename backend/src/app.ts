import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getConfig } from './config/env';
import { logger } from './utils/logger';
import { handleFastifyError } from './utils/errors';
import { healthRoutes } from './routes/health.route';
import { sseRoutes } from './routes/sse.route';
import { searchRoutes } from './routes/search.route';
import { getThumbnailStorageDir } from './utils/thumbnail-storage';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const config = getConfig();

  const app = fastify({
    loggerInstance: logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    requestIdHeader: 'x-request-id',
    ...opts,
  });

  // Centralized Error Handler
  app.setErrorHandler(handleFastifyError);

  // Propagate x-request-id header on all responses
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Register CORS
  app.register(cors, {
    origin: [config.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Last-Event-ID'],
  });

  // Register Multipart for image uploads
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1,
    },
  });

  // Register Core Routes
  app.register(healthRoutes);
  app.register(sseRoutes);
  app.register(searchRoutes);

  // Serve locally cached thumbnails
  app.get('/storage/thumbnails/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeName = path.basename(filename);
    const thumbDir = getThumbnailStorageDir();
    const filePath = path.join(thumbDir, safeName);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Thumbnail not found',
          retryable: false,
        },
      });
    }

    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    reply.type(mimeMap[ext] || 'image/jpeg');
    return reply.send(fs.createReadStream(filePath));
  });

  return app;
}
