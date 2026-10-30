import { ensurePostgresRunning, stopEmbeddedPostgres } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { closeDb } from '../src/db';
import { SearchRepository } from '../src/db/repositories/search.repository';
import { SearchResultRepository } from '../src/db/repositories/search-result.repository';
import { SourceRunRepository } from '../src/db/repositories/source-run.repository';
import { VideoRepository } from '../src/db/repositories/video.repository';
import { PipelineOrchestratorService } from '../src/services/pipeline-orchestrator.service';
import { getVisionProvider } from '../src/providers/vision';

interface TargetProduct {
  name: string;
  url: string;
}

const TARGETS: TargetProduct[] = [
  {
    name: 'Fenty Beauty Gloss Bomb Universal Lip Luminizer',
    url: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
  },
  {
    name: 'Represent 247 Oversized Tank',
    url: 'https://representclo.com/products/247-oversized-tank-26-jet-black',
  },
];

async function runPhase4LiveCheck() {
  console.log('========================================================================================');
  console.log('ViDashboard Phase 4: Hybrid Scoring, Deduplication & Shortfall Loop Live Verification');
  console.log('========================================================================================\n');

  await ensurePostgresRunning();
  await runMigrations();

  const searchRepo = new SearchRepository();
  const searchResultRepo = new SearchResultRepository();
  const sourceRunRepo = new SourceRunRepository();
  const orchestrator = new PipelineOrchestratorService();
  const visionProvider = getVisionProvider();

  console.log(`MODE:                     ${process.env.MODE || 'live'}`);
  console.log(`Active Vision Provider:   ${visionProvider.name}`);
  console.log(`Configured Gemini Model:  ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}`);
  console.log(`Apify Token Present:      ${Boolean(process.env.APIFY_TOKEN)}`);
  console.log(`Embedding Weight (w_emb): ${process.env.EMBEDDING_WEIGHT || 0.4}`);
  console.log(`Rubric Weight (w_rubric): ${process.env.RUBRIC_WEIGHT || 0.6}`);
  console.log(`Min Match Threshold:      ${process.env.MIN_MATCH_THRESHOLD || 60}`);
  console.log('----------------------------------------------------------------------------------------\n');

  let totalCheckCostUsd = 0;
  let totalApifyItems = 0;

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    console.log(`\n########################################################################################`);
    console.log(`PRODUCT ${i + 1}: ${target.name}`);
    console.log(`URL: ${target.url}`);
    console.log(`########################################################################################\n`);

    // ------------------------------------------------------------------------
    // RUN 1: Initial Discovery Run
    // ------------------------------------------------------------------------
    console.log(`>>> [RUN 1] Executing full 10-stage pipeline discovery...`);
    const searchRecord = await searchRepo.create({
      inputType: 'url',
      productUrl: target.url,
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      mode: 'live',
    });

    const run1Start = Date.now();
    await orchestrator.execute(searchRecord.id);
    const run1Duration = ((Date.now() - run1Start) / 1000).toFixed(1);
    console.log(`>>> [RUN 1] Pipeline completed in ${run1Duration}s (Search ID: ${searchRecord.id})\n`);

    // Fetch persisted results and source runs
    const resultsWithVideos = await searchResultRepo.getWithVideos(searchRecord.id);
    const sourceRuns = await sourceRunRepo.getBySearchId(searchRecord.id);

    // Breakdown per source
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`PER-SOURCE BREAKDOWN (Product ${i + 1} - Run 1):`);
    console.log(`----------------------------------------------------------------------------------------`);

    for (const source of ['instagram', 'meta']) {
      const sourceRun = sourceRuns.find((r) => r.source === source);
      const itemsForSource = resultsWithVideos.filter((r) => r.video.platform === source);

      const collected = sourceRun ? sourceRun.collected : itemsForSource.length;
      const duplicatesRemoved = itemsForSource.filter((r) => r.result.duplicateOf).length;
      const previouslySeenFiltered = itemsForSource.filter((r) => r.result.previouslySeen).length;
      const belowThreshold = itemsForSource.filter((r) => r.result.belowThreshold && !r.result.duplicateOf && !r.result.previouslySeen).length;
      const aboveThreshold = itemsForSource.filter((r) => !r.result.belowThreshold && !r.result.duplicateOf && !r.result.previouslySeen).length;
      const shortfall = Math.max(0, 20 - aboveThreshold);

      console.log(`\nPlatform: [${source.toUpperCase()}]`);
      console.log(`  - Collected:                 ${collected}`);
      console.log(`  - Duplicates Removed:        ${duplicatesRemoved}`);
      console.log(`  - Previously Seen Filtered:  ${previouslySeenFiltered}`);
      console.log(`  - Below Threshold (<60):     ${belowThreshold}`);
      console.log(`  - Final Above-Threshold:     ${aboveThreshold}`);
      console.log(`  - Usable Target Shortfall:   ${shortfall}`);

      // Apify cost reporting
      const perItemRate = source === 'instagram' ? 0.0025 : 0.00075;
      const estCost = collected * perItemRate;
      totalApifyItems += collected;
      totalCheckCostUsd += estCost;
      console.log(`  - Source Cost:               ${collected} items @ $${perItemRate}/item = $${estCost.toFixed(4)} USD`);
    }

    // Show 3 Good Matches (Highest match scores)
    const sortedAbove = resultsWithVideos
      .filter((r) => !r.result.duplicateOf && !r.result.previouslySeen)
      .sort((a, b) => b.result.matchScore - a.result.matchScore);

    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`3 SAMPLE GOOD MATCHES (Highest Hybrid Match Scores):`);
    console.log(`----------------------------------------------------------------------------------------`);
    const goodSample = sortedAbove.slice(0, 3);
    if (goodSample.length === 0) {
      console.log('  (No above-threshold candidates found)');
    } else {
      goodSample.forEach((item, idx) => {
        const breakdown = item.result.scoreBreakdown as any;
        console.log(`\n  [Good #${idx + 1}] Platform: ${item.video.platform.toUpperCase()} | ID: ${item.video.platformVideoId}`);
        console.log(`    URL:               ${item.video.canonicalUrl}`);
        console.log(`    Match Score:       ${item.result.matchScore} / 100 (Rank: ${item.result.rank || 'N/A'})`);
        console.log(`    Score Breakdown:   Embedding: ${breakdown?.embeddingScore ?? 'N/A'}, Rubric: ${breakdown?.rubricScore ?? 'N/A'}, Bonus: +${breakdown?.bonuses || 0}, Penalty: -${breakdown?.penalties || 0}`);
        console.log(`    Attribute Verdicts: ProductType=${breakdown?.attributeVerdicts?.productType}, Color=${breakdown?.attributeVerdicts?.color}, Brand=${breakdown?.attributeVerdicts?.brand}, Relevance=${breakdown?.attributeVerdicts?.relevance}`);
        console.log(`    Explanation:       "${item.result.explanation}"`);
        console.log(`    Caption Snippet:   "${(item.video.caption || '').replace(/\s+/g, ' ').slice(0, 100)}..."`);
      });
    }

    // Show 3 Bad Matches (Lowest match scores / below threshold)
    const sortedBelow = resultsWithVideos
      .filter((r) => r.result.belowThreshold || r.result.matchScore < 60)
      .sort((a, b) => a.result.matchScore - b.result.matchScore);

    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`3 SAMPLE BAD MATCHES (Lowest Hybrid Match Scores / Below Threshold):`);
    console.log(`----------------------------------------------------------------------------------------`);
    const badSample = sortedBelow.slice(0, 3);
    if (badSample.length === 0) {
      console.log('  (No below-threshold items in this batch)');
    } else {
      badSample.forEach((item, idx) => {
        const breakdown = item.result.scoreBreakdown as any;
        console.log(`\n  [Bad #${idx + 1}] Platform: ${item.video.platform.toUpperCase()} | ID: ${item.video.platformVideoId}`);
        console.log(`    URL:               ${item.video.canonicalUrl}`);
        console.log(`    Match Score:       ${item.result.matchScore} / 100 (Below Threshold: ${item.result.belowThreshold})`);
        console.log(`    Score Breakdown:   Embedding: ${breakdown?.embeddingScore ?? 'N/A'}, Rubric: ${breakdown?.rubricScore ?? 'N/A'}, Bonus: +${breakdown?.bonuses || 0}, Penalty: -${breakdown?.penalties || 0}`);
        console.log(`    Attribute Verdicts: ProductType=${breakdown?.attributeVerdicts?.productType}, Color=${breakdown?.attributeVerdicts?.color}, Brand=${breakdown?.attributeVerdicts?.brand}, Relevance=${breakdown?.attributeVerdicts?.relevance}`);
        console.log(`    Explanation:       "${item.result.explanation}"`);
        console.log(`    Caption Snippet:   "${(item.video.caption || '').replace(/\s+/g, ' ').slice(0, 100)}..."`);
      });
    }

    // ------------------------------------------------------------------------
    // RUN 2: Re-run the SAME search to prove cross-search deduplication!
    // ------------------------------------------------------------------------
    if (i === 0) {
      console.log(`\n========================================================================================`);
      console.log(`CROSS-SEARCH DEDUPLICATION TEST: Running SAME search a SECOND time for Product 1`);
      console.log(`========================================================================================\n`);

      const repeatSearchRecord = await searchRepo.create({
        inputType: 'url',
        productUrl: target.url,
        selectedSources: ['instagram', 'meta'],
        minMatchThreshold: 60,
        mode: 'live',
      });

      const run2Start = Date.now();
      await orchestrator.execute(repeatSearchRecord.id);
      const run2Duration = ((Date.now() - run2Start) / 1000).toFixed(1);

      console.log(`>>> [RUN 2] Repeat search completed in ${run2Duration}s (Search ID: ${repeatSearchRecord.id})\n`);

      const run2Results = await searchResultRepo.getWithVideos(repeatSearchRecord.id);
      const run2SourceRuns = await sourceRunRepo.getBySearchId(repeatSearchRecord.id);

      console.log(`----------------------------------------------------------------------------------------`);
      console.log(`PER-SOURCE BREAKDOWN (Product 1 - Repeat Run 2):`);
      console.log(`----------------------------------------------------------------------------------------`);

      for (const source of ['instagram', 'meta']) {
        const sourceRun = run2SourceRuns.find((r) => r.source === source);
        const itemsForSource = run2Results.filter((r) => r.video.platform === source);

        const collected = sourceRun ? sourceRun.collected : itemsForSource.length;
        const duplicatesRemoved = itemsForSource.filter((r) => r.result.duplicateOf).length;
        const previouslySeenFiltered = itemsForSource.filter((r) => r.result.previouslySeen).length;
        const belowThreshold = itemsForSource.filter((r) => r.result.belowThreshold && !r.result.duplicateOf && !r.result.previouslySeen).length;
        const aboveThreshold = itemsForSource.filter((r) => !r.result.belowThreshold && !r.result.duplicateOf && !r.result.previouslySeen).length;
        const shortfall = Math.max(0, 20 - aboveThreshold);

        console.log(`\nPlatform: [${source.toUpperCase()}]`);
        console.log(`  - Collected:                 ${collected}`);
        console.log(`  - Duplicates Removed:        ${duplicatesRemoved}`);
        console.log(`  - Previously Seen Filtered:  ${previouslySeenFiltered}`);
        console.log(`  - Below Threshold (<60):     ${belowThreshold}`);
        console.log(`  - Final Above-Threshold:     ${aboveThreshold}`);
        console.log(`  - Usable Target Shortfall:   ${shortfall}`);
      }

      const run1VideoIds = new Set(
        resultsWithVideos
          .filter((r) => !r.result.belowThreshold && !r.result.duplicateOf)
          .map((r) => r.video.id)
      );

      const run2PreviouslySeen = run2Results.filter((r) => r.result.previouslySeen);
      const run2ReturnedRepeats = run2Results.filter(
        (r) => !r.result.belowThreshold && !r.result.previouslySeen && run1VideoIds.has(r.video.id)
      );

      console.log(`\nCross-Search Deduplication Verification Results:`);
      console.log(`  - Total Candidates Evaluated in Run 2:      ${run2Results.length}`);
      console.log(`  - Previously Seen Filtered in Run 2:        ${run2PreviouslySeen.length}`);
      console.log(`  - Returned Repeats from Run 1:              ${run2ReturnedRepeats.length} (Expected: 0)`);
      console.log(`  - Verdict:                                  ${run2ReturnedRepeats.length === 0 ? 'SUCCESS - ZERO REPEATS VERIFIED' : 'FAILED - REPEATS DETECTED'}\n`);
    }
  }

  console.log('\n========================================================================================');
  console.log('TOTAL COST & USAGE SUMMARY FOR PHASE 4 LIVE CHECK');
  console.log('========================================================================================');
  console.log(`Total Apify Items Fetched: ${totalApifyItems}`);
  console.log(`Total Estimated Apify Cost: $${totalCheckCostUsd.toFixed(4)} USD`);
  console.log('========================================================================================\n');

  await closeDb();
  await stopEmbeddedPostgres();
}

runPhase4LiveCheck().catch(async (err) => {
  console.error('Phase 4 Live Check Failed:', err);
  await closeDb();
  await stopEmbeddedPostgres();
  process.exit(1);
});
