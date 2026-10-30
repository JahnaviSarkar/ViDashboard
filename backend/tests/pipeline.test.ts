import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { ensurePostgresRunning } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { PipelineOrchestratorService } from '../src/services/pipeline-orchestrator.service';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { ProductRepository } from '../src/db/repositories/product.repository';
import { ProductAnalysisRepository } from '../src/db/repositories/product-analysis.repository';
import { PipelineEventRepository } from '../src/db/repositories/pipeline-event.repository';
import { initBoss, stopBoss } from '../src/queue/boss';
import { FastifyInstance } from 'fastify';

describe('Phase 2 Pipeline Orchestrator & Search APIs', () => {
  let app: FastifyInstance;
  const searchRepo = new SearchRepository();
  const productRepo = new ProductRepository();
  const analysisRepo = new ProductAnalysisRepository();
  const eventRepo = new PipelineEventRepository();
  const orchestrator = new PipelineOrchestratorService();

  beforeAll(async () => {
    await ensurePostgresRunning();
    await runMigrations();
    await initBoss();
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await stopBoss();
  });

  it('POST /api/search accepts keyword search, returns 202 Accepted, and executes pipeline stages', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'Vintage Wooden Train Set',
        sources: ['instagram', 'meta'],
        minMatchThreshold: 65,
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.searchId).toBeDefined();
    expect(body.status).toBe('pending');
    expect(body.inputType).toBe('keyword');

    const searchId = body.searchId;

    // Execute pipeline orchestrator
    await orchestrator.execute(searchId);

    // Verify search completed
    const updatedSearch = await searchRepo.getById(searchId);
    expect(updatedSearch?.status).toBe('completed');
    expect(updatedSearch?.completedAt).toBeDefined();

    // Verify product record created
    const product = await productRepo.getBySearchId(searchId);
    expect(product).not.toBeNull();
    expect(product?.title).toBe('Vintage Wooden Train Set');
    expect(product?.imageHash).toBeDefined();

    // Verify product analysis created
    const analysis = await analysisRepo.getByImageHash(product!.imageHash!);
    expect(analysis).not.toBeNull();
    expect((analysis?.attributes as any).productType).toBeDefined();
    expect((analysis?.attributes as any).isTextDerived).toBe(true);
    expect((analysis?.queries as any).expansionTiers).toBeDefined();

    // Verify pipeline events were emitted and persisted
    const events = await eventRepo.getEventsForReplay(searchId);
    expect(events.length).toBeGreaterThanOrEqual(10);

    const stages = events.map((e) => e.stage);
    expect(stages).toContain('resolving_product');
    expect(stages).toContain('extracting_image');
    expect(stages).toContain('analysing_image');
    expect(stages).toContain('generating_queries');
    expect(stages).toContain('fetching_instagram');
    expect(stages).toContain('finalizing_results');

    // Future stages must be flagged as skipped
    const instagramEvent = events.find((e) => e.stage === 'fetching_instagram');
    expect(instagramEvent?.status).toBe('skipped');

    const finalEvent = events.find((e) => e.stage === 'finalizing_results');
    expect(finalEvent?.status).toBe('done');
  });

  it('GET /api/search/:id returns full search details, product, analysis, and source runs', async () => {
    const search = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'Smart Espresso Maker',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    await orchestrator.execute(search.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/search/${search.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.search.id).toBe(search.id);
    expect(body.product.title).toBe('Smart Espresso Maker');
    expect(body.analysis).not.toBeNull();
    expect(body.analysis.attributes).toBeDefined();
  });

  it('GET /api/history returns recent searches list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/history?limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.searches)).toBe(true);
    expect(body.searches.length).toBeGreaterThan(0);
  });

  it('re-analyzing product with identical image hash hits analysis cache', async () => {
    const search1 = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'Artisan Ceramic Vase',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    await orchestrator.execute(search1.id);
    const product1 = await productRepo.getBySearchId(search1.id);
    const analysis1 = await analysisRepo.getByImageHash(product1!.imageHash!);

    // Run identical second search
    const search2 = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'Artisan Ceramic Vase',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    await orchestrator.execute(search2.id);
    const product2 = await productRepo.getBySearchId(search2.id);
    const analysis2 = await analysisRepo.getByImageHash(product2!.imageHash!);

    // Analysis ID should be identical because it was cached by image hash
    expect(analysis1?.id).toBe(analysis2?.id);
  });

  it('POST /api/search/:id/retry re-enqueues search and resets status', async () => {
    const search = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'Failing Search Item',
      selectedSources: ['instagram'],
      minMatchThreshold: 60,
      mode: 'live',
      status: 'failed',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/search/${search.id}/retry`,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('pending');

    const updated = await searchRepo.getById(search.id);
    expect(updated?.status).toBe('pending');
  });
});
