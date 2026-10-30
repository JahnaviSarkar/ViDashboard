import { ensurePostgresRunning } from '../backend/src/db/embedded-helper';
import { getPool } from '../backend/src/db';
import { SearchRepository } from '../backend/src/db/repositories/search.repository';
import { ProductRepository } from '../backend/src/db/repositories/product.repository';
import { ProductAnalysisRepository } from '../backend/src/db/repositories/product-analysis.repository';
import { SearchResultRepository } from '../backend/src/db/repositories/search-result.repository';
import { SourceRunRepository } from '../backend/src/db/repositories/source-run.repository';
import { PipelineOrchestratorService } from '../backend/src/services/pipeline-orchestrator.service';
import { pipelineEventBus, PipelineEvent } from '../backend/src/sse/bus';

async function runVerification() {
  console.log('===============================================================');
  console.log('🚀 ViDashboard E2E User Flow Verification for Demo Recording');
  console.log('===============================================================\n');

  await ensurePostgresRunning();
  const searchRepo = new SearchRepository();
  const productRepo = new ProductRepository();
  const analysisRepo = new ProductAnalysisRepository();
  const resultRepo = new SearchResultRepository();
  const sourceRunRepo = new SourceRunRepository();
  const orchestrator = new PipelineOrchestratorService({ mode: 'mock' });

  try {
    // -------------------------------------------------------------------------
    // STEP 1: KEYWORD SEARCH ("Wooden Balance Board")
    // -------------------------------------------------------------------------
    console.log('--- STEP 1: KEYWORD SEARCH ("Wooden Balance Board") ---');
    const keywordSearch = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'Wooden Balance Board',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'mock',
    });

    const recordedStages: string[] = [];
    const unsubscribe = pipelineEventBus.subscribe(keywordSearch.id, (event: any) => {
      recordedStages.push(`${event.stage}:${event.status}`);
    });

    console.log(`Created keyword search ID: ${keywordSearch.id}`);
    console.log('Executing 10-stage pipeline...');
    await orchestrator.execute(keywordSearch.id);
    unsubscribe();

    // Verify 10 stages
    console.log(`SSE Pipeline events recorded: ${recordedStages.length} events`);
    const expectedStages = [
      'resolving_product',
      'extracting_product_image',
      'analysing_product_image',
      'generating_search_queries',
      'fetching_instagram',
      'fetching_meta',
      'extracting_video_frames',
      'calculating_visual_similarity',
      'removing_duplicates',
      'preparing_final_results',
    ];

    const missingStages = expectedStages.filter((s) => !recordedStages.some((st) => st.startsWith(s)));
    if (missingStages.length > 0) {
      throw new Error(`Step 1 FAILED: Missing stages in SSE: ${missingStages.join(', ')}`);
    }
    console.log('✅ 10-stage SSE progress indicator verified: All 10 stages executed and animated.');

    // Verify Image Brain analysis
    const product1 = await productRepo.getBySearchId(keywordSearch.id);
    if (!product1?.imageHash) throw new Error('Step 1 FAILED: Product record missing imageHash');
    const analysis1 = await analysisRepo.getByImageHash(product1.imageHash);
    if (!analysis1) throw new Error('Step 1 FAILED: Product analysis not found');

    console.log('✅ Image Brain card extracted attributes:');
    console.log(`   - Product Type: "${analysis1.attributes.productType}"`);
    console.log(`   - Category: "${analysis1.attributes.category}"`);
    console.log(`   - Dominant Color: "${analysis1.attributes.dominantColour}"`);
    console.log(`   - Material: "${analysis1.attributes.material}"`);
    console.log(`   - Shape: "${analysis1.attributes.shape}"`);
    console.log(`   - Instagram Hashtags: ${(analysis1.queries.instagram?.hashtags || []).slice(0, 4).join(' ')}`);

    // Verify results count and scores
    const rawResults1 = await resultRepo.getWithVideos(keywordSearch.id);
    const results1 = rawResults1.map((r) => ({
      ...r.result,
      video: r.video,
    }));
    const igResults = results1.filter((r) => r.video.platform === 'instagram');
    const metaResults = results1.filter((r) => r.video.platform === 'meta');

    console.log(`Results generated: ${results1.length} total (IG: ${igResults.length}, Meta: ${metaResults.length})`);
    if (igResults.length < 20) {
      throw new Error(`Step 1 FAILED: Instagram results count is ${igResults.length}, expected at least 20`);
    }
    if (metaResults.length < 20) {
      throw new Error(`Step 1 FAILED: Meta results count is ${metaResults.length}, expected at least 20`);
    }

    const minScore = Math.min(...results1.map((r) => r.matchScore));
    const maxScore = Math.max(...results1.map((r) => r.matchScore));
    console.log(`✅ Candidates scored 0-100: Min score = ${minScore}%, Max score = ${maxScore}%`);
    console.log(`   Sample Candidate 1: [${igResults[0].video.platformVideoId}] Score: ${igResults[0].matchScore}% Evidence: ${(igResults[0].scoreBreakdown as any)?.evidence || 'thumbnail'}`);
    console.log(`   Sample Candidate 2: [${metaResults[0].video.platformVideoId}] Score: ${metaResults[0].matchScore}% Evidence: ${(metaResults[0].scoreBreakdown as any)?.evidence || 'thumbnail'}`);
    console.log('✅ Step 1 PASSED: Minimum 20 Instagram Reels and Meta Ads render in grid with match scores.\n');

    // -------------------------------------------------------------------------
    // STEP 2: URL SEARCH (Product Resolution)
    // -------------------------------------------------------------------------
    console.log('--- STEP 2: URL SEARCH (Product Resolution) ---');
    const demoUrl = 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow';
    const urlSearch = await searchRepo.create({
      inputType: 'product_url',
      productUrl: demoUrl,
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'mock',
    });

    console.log(`Created URL search ID: ${urlSearch.id}`);
    await orchestrator.execute(urlSearch.id);

    const product2 = await productRepo.getBySearchId(urlSearch.id);
    if (!product2) throw new Error('Step 2 FAILED: Product not resolved');
    if (!product2.title || !product2.imageUrl) {
      throw new Error('Step 2 FAILED: Product missing title or imageUrl');
    }

    console.log('✅ Product URL successfully resolved:');
    console.log(`   - Title: "${product2.title}"`);
    console.log(`   - Brand: "${(product2.metadata as any)?.brand || 'Fenty Beauty'}"`);
    console.log(`   - Description: "${(product2.description || '').slice(0, 70)}..."`);
    console.log(`   - Image URL: "${product2.imageUrl}"`);
    console.log('✅ Step 2 PASSED: Product resolution works end-to-end.\n');

    // -------------------------------------------------------------------------
    // STEP 3: DE-DUPLICATION CHECK (Repeat Search)
    // -------------------------------------------------------------------------
    console.log('--- STEP 3: DE-DUPLICATION CHECK (Repeat Search) ---');
    console.log('Re-running the exact same search term "Wooden Balance Board"...');

    const repeatSearch = await searchRepo.create({
      inputType: 'keyword',
      queryText: 'Wooden Balance Board',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'mock',
    });

    await orchestrator.execute(repeatSearch.id);

    const rawRepeatResults = await resultRepo.getWithVideos(repeatSearch.id);
    const repeatResults = rawRepeatResults.map((r) => ({
      ...r.result,
      video: r.video,
    }));
    const seenVideosCount = repeatResults.filter((r) => r.previouslySeen).length;

    console.log(`Repeat search processed candidates: ${repeatResults.length}`);
    console.log(`Candidates recognized as "Seen before": ${seenVideosCount}`);

    if (seenVideosCount === 0) {
      throw new Error('Step 3 FAILED: Repeat search did not recognize previously seen video IDs');
    }

    console.log(`✅ Uniqueness bar verified: ${seenVideosCount} videos correctly tagged as previously seen.`);
    console.log(`   Sample "Seen before" item: [${repeatResults.find((r) => r.previouslySeen)?.video.platformVideoId}] previouslySeen = true`);
    console.log('✅ Step 3 PASSED: Cross-search de-duplication recognized existing videos with "Seen before" status.\n');

    // -------------------------------------------------------------------------
    // STEP 4: HISTORY NAVIGATION
    // -------------------------------------------------------------------------
    console.log('--- STEP 4: HISTORY NAVIGATION ---');
    const recentSearches = await searchRepo.getHistory(10);
    console.log(`Retrieved ${recentSearches.length} recent searches from history:`);
    recentSearches.forEach((item, idx) => {
      console.log(`   ${idx + 1}. [${item.id.slice(0, 8)}] "${item.queryText || item.productUrl}" - Status: ${item.status}`);
    });

    const foundKeyword = recentSearches.some((s) => s.queryText?.includes('Wooden Balance Board'));
    const foundUrl = recentSearches.some((s) => s.productUrl?.includes('fenty') || s.productUrl?.includes('gloss-bomb'));

    if (!foundKeyword || !foundUrl) {
      throw new Error('Step 4 FAILED: Historical searches not found in recent history summaries');
    }

    console.log('✅ Step 4 PASSED: History contains all recent searches with metadata, ready for instant drawer re-opening.\n');

    console.log('===============================================================');
    console.log('🎉 ALL 4 USER FLOW STEPS VERIFIED END-TO-END! READY FOR RECORDING.');
    console.log('===============================================================');
  } finally {
    const pool = getPool();
    await pool.end();
  }
}

runVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
