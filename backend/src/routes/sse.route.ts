import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineEventRepository } from '../db/repositories/pipeline-event.repository';
import { SearchRepository } from '../db/repositories/search.repository';
import { pipelineEventBus } from '../sse/bus';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

interface SseParams {
  id: string;
}

interface SseQuery {
  lastEventId?: string;
}

export async function sseRoutes(app: FastifyInstance) {
  const eventRepo = new PipelineEventRepository();
  const searchRepo = new SearchRepository();

  app.get<{ Params: SseParams; Querystring: SseQuery }>(
    '/api/search/:id/events',
    async (request: FastifyRequest<{ Params: SseParams; Querystring: SseQuery }>, reply: FastifyReply) => {
      const searchId = request.params.id;

      // Verify search exists
      const search = await searchRepo.getById(searchId);
      if (!search) {
        throw new NotFoundError(`Search with ID '${searchId}' was not found`);
      }

      // Check for Last-Event-ID from headers or querystring
      const lastEventIdHeader = request.headers['last-event-id'] as string | undefined;
      const lastEventIdQuery = request.query.lastEventId;
      const rawLastId = lastEventIdHeader || lastEventIdQuery;
      const sinceEventId = rawLastId ? parseInt(rawLastId, 10) : undefined;

      // Set headers for SSE
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      logger.info({ searchId, sinceEventId }, 'Client connected to SSE event stream');

      // Helper to format SSE chunk
      const sendSseMessage = (id: number | string, event: string, data: unknown) => {
        const payload = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        reply.raw.write(payload);
      };

      // 1. Replay historical events from pipeline_events
      const pastEvents = await eventRepo.getEventsForReplay(searchId, sinceEventId);
      for (const ev of pastEvents) {
        sendSseMessage(ev.id, ev.stage, {
          id: ev.id,
          searchId: ev.searchId,
          stage: ev.stage,
          status: ev.status,
          payload: ev.payload,
          createdAt: ev.createdAt,
        });
      }

      // 2. Subscribe to new live events
      const unsubscribe = pipelineEventBus.subscribe(searchId, (ev) => {
        sendSseMessage(ev.id, ev.stage, {
          id: ev.id,
          searchId: ev.searchId,
          stage: ev.stage,
          status: ev.status,
          payload: ev.payload,
          createdAt: ev.createdAt,
        });
      });

      // 3. Keepalive heartbeat
      const keepaliveTimer = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
      }, 15000);

      // 4. Handle client disconnect
      request.raw.on('close', () => {
        clearInterval(keepaliveTimer);
        unsubscribe();
        logger.info({ searchId }, 'Client disconnected from SSE stream');
      });

      // Keep connection open indefinitely until client disconnects
      return reply;
    }
  );
}
