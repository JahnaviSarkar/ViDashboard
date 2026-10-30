import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { pipelineEventBus } from '../src/sse/bus';
import { FastifyInstance } from 'fastify';

describe('Server-Sent Events (SSE) Streaming and Last-Event-ID Replay', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  const searchRepo = new SearchRepository();

  beforeAll(async () => {
    await ensurePostgresRunning();
    await runMigrations();
    app = buildApp();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = address;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 with structured error when search does not exist', async () => {
    const res = await fetch(`${serverUrl}/api/search/non-existent-search-id/events`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.retryable).toBe(false);
  });

  it('streams a live pipeline event to a connected client', async () => {
    const search = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'test sse keyword',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const controller = new AbortController();

    // Start fetching SSE stream
    const fetchPromise = fetch(`${serverUrl}/api/search/${search.id}/events`, {
      signal: controller.signal,
    });

    // In background, emit event after a brief delay
    setTimeout(async () => {
      await pipelineEventBus.emitAndPersist({
        searchId: search.id,
        stage: 'resolving_product',
        status: 'running',
        payload: { progress: 10, message: 'Resolving product details' },
      });
    }, 100);

    const res = await fetchPromise;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (!accumulated.includes('event: resolving_product')) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }

    controller.abort(); // Close client connection cleanly

    expect(accumulated).toContain('event: resolving_product');
    expect(accumulated).toContain('"stage":"resolving_product"');
    expect(accumulated).toContain('"progress":10');
  });

  it('replays historical events using Last-Event-ID header upon reconnect', async () => {
    const search = await searchRepo.create({
      inputType: 'product_url',
      productUrl: 'https://example.com/item',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    // Persist 3 sequential events into pipeline_events
    const ev1 = await pipelineEventBus.emitAndPersist({
      searchId: search.id,
      stage: 'resolving_product',
      status: 'done',
      payload: { title: 'Test Toy' },
    });

    const ev2 = await pipelineEventBus.emitAndPersist({
      searchId: search.id,
      stage: 'analysing_product_image',
      status: 'running',
      payload: { step: 'detecting colours' },
    });

    const ev3 = await pipelineEventBus.emitAndPersist({
      searchId: search.id,
      stage: 'fetching_instagram',
      status: 'running',
      payload: { count: 5 },
    });

    expect(ev1.id).toBeLessThan(ev2.id);
    expect(ev2.id).toBeLessThan(ev3.id);

    const controller = new AbortController();

    // Reconnect requesting events strictly AFTER ev1.id
    const res = await fetch(`${serverUrl}/api/search/${search.id}/events`, {
      headers: {
        'last-event-id': String(ev1.id),
      },
      signal: controller.signal,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (!accumulated.includes(`id: ${ev3.id}\n`)) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }

    controller.abort(); // Disconnect client

    // ev1 should NOT be in the replayed output
    expect(accumulated).not.toContain(`id: ${ev1.id}\n`);

    // ev2 and ev3 MUST be in the replayed output
    expect(accumulated).toContain(`id: ${ev2.id}\n`);
    expect(accumulated).toContain('event: analysing_product_image');
    expect(accumulated).toContain(`id: ${ev3.id}\n`);
    expect(accumulated).toContain('event: fetching_instagram');
  });
});
