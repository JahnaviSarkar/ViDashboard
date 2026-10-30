import { ensurePostgresRunning, stopEmbeddedPostgres } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { closeDb } from '../src/db';
import { ProductResolverService } from '../src/services/product-resolver.service';
import { getVisionProvider } from '../src/providers/vision';
import { QueryGeneratorService } from '../src/services/query-generator.service';
import { InstagramCollector } from '../src/collectors/instagram.collector';
import { MetaAdLibraryCollector } from '../src/collectors/meta-ad-library.collector';
import { TikTokCollector } from '../src/collectors/tiktok.collector';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { SourceRunRepository } from '../src/db/repositories/source-run.repository';
import { PipelineOrchestratorService } from '../src/services/pipeline-orchestrator.service';

async function main() {
  console.log('===============================================================');
  console.log('ViDashboard - Phase 3 Live Verification Check');
  console.log('===============================================================\n');

  await ensurePostgresRunning();
  await runMigrations();

  const resolver = new ProductResolverService();
  const visionProvider = getVisionProvider();
  const queryGenerator = new QueryGeneratorService();
  const searchRepo = new SearchRepository();
  const sourceRunRepo = new SourceRunRepository();

  console.log(`Operational MODE:        ${process.env.MODE || 'live'}`);
  console.log(`Active Vision Provider:  ${visionProvider.name}`);
  console.log(`Configured Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}`);
  console.log(`Instagram Token Present: ${Boolean(process.env.INSTAGRAM_ACCESS_TOKEN)}`);
  console.log(`Meta Token Present:      ${Boolean(process.env.META_ACCESS_TOKEN)}`);
  console.log(`TikTok Token Present:    ${Boolean(process.env.TIKTOK_ACCESS_TOKEN)}\n`);

  // Target 1: Real Product URL (Fenty Beauty Gloss Bomb)
  const targetUrl = 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow';
  console.log(`--- [Target 1] Resolving Real Product URL ---`);
  console.log(`  URL: ${targetUrl}`);

  const resolved = await resolver.resolve(targetUrl);
  console.log(`  Resolved Title: ${resolved.title}`);
  console.log(`  Resolved Brand: ${resolved.brand || 'N/A'}`);
  console.log(`  Resolved Price: ${resolved.price !== undefined ? `${resolved.currency || '$'} ${resolved.price}` : 'null'}`);
  console.log(`  Resolved Image: ${resolved.imageUrl || 'None'}\n`);

  console.log(`--- [Target 1] Running Image Brain & Query Generator ---`);
  const analysis = await visionProvider.analyze({
    title: resolved.title,
    description: resolved.description,
    imageUrl: resolved.imageUrl,
    imageBuffer: resolved.imageBuffer,
  });

  console.log(`  Product Type: ${analysis.productType}`);
  console.log(`  Category:     ${analysis.category}`);
  console.log(`  Model Used:   ${analysis.modelUsed || 'default'}`);

  const queries = queryGenerator.generate(analysis, resolved.brand);
  console.log(`  Generated Instagram Hashtags (${queries.instagram.hashtags.length}): ${queries.instagram.hashtags.slice(0, 8).join(', ')}`);
  console.log(`  Generated Meta Search Terms: ${queries.meta.searchTerms.slice(0, 4).join(', ')}\n`);

  // Run Real Live Collectors (Phase 3)
  console.log(`--- [Target 1] Executing Real Live Collectors (Target: 20 per source) ---`);
  const liveIgCollector = new InstagramCollector({ mode: 'live' });
  const liveMetaCollector = new MetaAdLibraryCollector({ mode: 'live' });
  const liveTiktokCollector = new TikTokCollector({ mode: 'live' });

  const igResult = await liveIgCollector.collect(queries, { targetCount: 20, searchId: 'live-check-001' });
  console.log(`  [Instagram Reels Collector - LIVE]`);
  console.log(`    Status:    ${igResult.error ? 'BLOCKED / SHORTFALL' : 'SUCCESS'}`);
  console.log(`    Requested: ${igResult.requested}`);
  console.log(`    Collected: ${igResult.collected}`);
  console.log(`    Usable:    ${igResult.usable}`);
  console.log(`    Shortfall: ${igResult.shortfall}`);
  console.log(`    Error:     ${igResult.error || 'None'}`);

  const metaResult = await liveMetaCollector.collect(queries, { targetCount: 20, searchId: 'live-check-001' });
  console.log(`  [Meta Ad Library Collector - LIVE]`);
  console.log(`    Status:    ${metaResult.error ? 'BLOCKED / SHORTFALL' : 'SUCCESS'}`);
  console.log(`    Requested: ${metaResult.requested}`);
  console.log(`    Collected: ${metaResult.collected}`);
  console.log(`    Usable:    ${metaResult.usable}`);
  console.log(`    Shortfall: ${metaResult.shortfall}`);
  console.log(`    Error:     ${metaResult.error || 'None'}`);

  const tiktokResult = await liveTiktokCollector.collect(queries, { targetCount: 20, searchId: 'live-check-001' });
  console.log(`  [TikTok Collector - LIVE]`);
  console.log(`    Status:    ${tiktokResult.error ? 'UNCONFIGURED (OPTIONAL)' : 'SUCCESS'}`);
  console.log(`    Requested: ${tiktokResult.requested}`);
  console.log(`    Collected: ${tiktokResult.collected}`);
  console.log(`    Usable:    ${tiktokResult.usable}`);
  console.log(`    Shortfall: ${tiktokResult.shortfall}`);
  console.log(`    Error:     ${tiktokResult.error || 'None'}\n`);

  // Target 2: End-to-End Orchestrator Pipeline Run with Shortfall Accounting in Database
  console.log(`--- [Target 2] End-to-End Pipeline Orchestration & Source Runs Persistence ---`);
  const search = await searchRepo.create({
    inputType: 'product_url',
    productUrl: targetUrl,
    selectedSources: ['instagram', 'meta'],
    minMatchThreshold: 60,
    mode: 'live',
  });

  const orchestrator = new PipelineOrchestratorService({ mode: 'live' });
  await orchestrator.execute(search.id);

  const runs = await sourceRunRepo.getBySearchId(search.id);
  console.log(`  Pipeline Source Runs in Database for Search ${search.id}:`);
  for (const run of runs) {
    console.log(`    Source:    ${run.source.toUpperCase()}`);
    console.log(`    Status:    ${run.status}`);
    console.log(`    Requested: ${run.requested}`);
    console.log(`    Collected: ${run.collected}`);
    console.log(`    Usable:    ${run.usable}`);
    console.log(`    Shortfall: ${run.shortfall}`);
    console.log(`    Error:     ${run.error || 'None'}`);
    console.log(`    Duration:  ${run.finishedAt && run.startedAt ? (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) + 'ms' : 'N/A'}`);
  }

  // Also verify Mock Collector behavior for comparison
  console.log(`\n--- [Comparison] Executing Mock Collectors (MODE=mock) ---`);
  const mockIgCollector = new InstagramCollector({ mode: 'mock' });
  const mockMetaCollector = new MetaAdLibraryCollector({ mode: 'mock' });

  const mockIgRes = await mockIgCollector.collect(queries, { targetCount: 20, searchId: 'mock-check-001' });
  const mockMetaRes = await mockMetaCollector.collect(queries, { targetCount: 20, searchId: 'mock-check-001' });

  console.log(`  [Instagram Reels - MOCK] Collected: ${mockIgRes.collected}, Usable: ${mockIgRes.usable}, Shortfall: ${mockIgRes.shortfall}, isMock: ${mockIgRes.candidates[0]?.isMock}`);
  console.log(`  [Meta Ad Library - MOCK] Collected: ${mockMetaRes.collected}, Usable: ${mockMetaRes.usable}, Shortfall: ${mockMetaRes.shortfall}, isMock: ${mockMetaRes.candidates[0]?.isMock}`);

  console.log('\n===============================================================');
  console.log('ViDashboard - Phase 3 Live Verification Check Complete');
  console.log('===============================================================\n');

  await closeDb();
  await stopEmbeddedPostgres();
}

main().catch((err) => {
  console.error('Phase 3 Live Check encountered fatal error:', err);
  process.exit(1);
});

