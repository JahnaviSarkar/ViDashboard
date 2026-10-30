import { ensurePostgresRunning, stopEmbeddedPostgres } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { closeDb } from '../src/db';
import { ProductResolverService } from '../src/services/product-resolver.service';
import { getVisionProvider } from '../src/providers/vision';
import { QueryGeneratorService } from '../src/services/query-generator.service';
import { InstagramCollector } from '../src/collectors/instagram.collector';
import { MetaAdLibraryCollector } from '../src/collectors/meta-ad-library.collector';
import { RawVideoCandidate } from '../src/collectors/types';

interface ProductTarget {
  name: string;
  url: string;
}

const TARGETS: ProductTarget[] = [
  {
    name: 'Fenty Beauty Gloss Bomb Universal Lip Luminizer',
    url: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
  },
  {
    name: 'Represent 247 Oversized Tank',
    url: 'https://representclo.com/products/247-oversized-tank-26-jet-black',
  },
];

function printCandidates(sourceName: string, candidates: RawVideoCandidate[]) {
  console.log(`\n  --- 5 Sample Candidates for ${sourceName} ---`);
  if (candidates.length === 0) {
    console.log('    (No candidates collected)');
    return;
  }

  const sample = candidates.slice(0, 5);
  sample.forEach((c, idx) => {
    const captionSnippet = (c.caption || '').replace(/\s+/g, ' ').slice(0, 100);
    console.log(`    [#${idx + 1}] Platform ID: ${c.platformVideoId}`);
    console.log(`         URL:         ${c.canonicalUrl}`);
    console.log(`         Thumbnail:   ${c.thumbnailUrl || 'None'}`);
    console.log(`         Author:      ${c.author || 'N/A'}`);
    console.log(`         IsMock:      ${c.isMock}`);
    console.log(`         Caption:     "${captionSnippet}${c.caption && c.caption.length > 100 ? '...' : ''}"`);
  });
}

async function runLiveCheck() {
  console.log('========================================================================');
  console.log('ViDashboard Phase 3b: Live Provider-Based Collection Verification');
  console.log('========================================================================\n');

  await ensurePostgresRunning();
  await runMigrations();

  const resolver = new ProductResolverService();
  const visionProvider = getVisionProvider();
  const queryGenerator = new QueryGeneratorService();

  console.log(`MODE:                     ${process.env.MODE || 'live'}`);
  console.log(`Active Vision Provider:   ${visionProvider.name}`);
  console.log(`Configured Gemini Model:  ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
  console.log(`Apify Token Configured:   ${Boolean(process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)}`);
  console.log(`Instagram Actor:          ${process.env.APIFY_INSTAGRAM_ACTOR || 'apify/instagram-hashtag-scraper'}`);
  console.log(`Meta Ads Actor:           ${process.env.APIFY_META_ADS_ACTOR || 'curious_coder/facebook-ads-library-scraper'}\n`);

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    console.log('========================================================================');
    console.log(`PRODUCT ${i + 1}: ${target.name}`);
    console.log(`URL: ${target.url}`);
    console.log('========================================================================\n');

    // 1. Resolve Product
    console.log('1. Resolving product metadata...');
    const resolved = await resolver.resolve(target.url);
    console.log(`   Title: ${resolved.title}`);
    console.log(`   Brand: ${resolved.brand || '(none)'}`);
    console.log(`   Price: ${resolved.price !== null ? `${resolved.currency || '$'} ${resolved.price}` : 'null'}`);
    console.log(`   Image: ${resolved.imageUrl || 'None'}`);

    // 2. Vision Brain Analysis
    console.log('\n2. Running Vision Brain analysis...');
    const analysis = await visionProvider.analyze({
      title: resolved.title,
      description: resolved.description,
      imageUrl: resolved.imageUrl,
      imageBuffer: resolved.imageBuffer,
    });
    console.log(`   Product Type: ${analysis.productType}`);
    console.log(`   Category:     ${analysis.category}`);
    console.log(`   Model Used:   ${analysis.modelUsed || 'default'}`);

    // 3. Query Generation
    console.log('\n3. Generating concept search queries & hashtags...');
    const queries = queryGenerator.generate(analysis, resolved.brand);
    console.log(`   Instagram Hashtags: ${queries.instagram.hashtags.slice(0, 6).join(' ')}`);
    console.log(`   Meta Search Terms:  ${queries.meta.searchTerms.slice(0, 3).map((s) => `"${s}"`).join(', ')}`);

    // 4. Live Collectors (Instagram & Meta Ads via Apify)
    const igCollector = new InstagramCollector({ mode: 'live' });
    const metaCollector = new MetaAdLibraryCollector({ mode: 'live' });

    console.log('\n4. Executing Instagram Collector (Target: 20)...');
    const igResult = await igCollector.collect(queries, {
      targetCount: 20,
      searchId: `phase3b-live-ig-${i + 1}`,
    });

    console.log(`   [Instagram Reels Collector Counts]`);
    console.log(`     Requested:  ${igResult.requested}`);
    console.log(`     Collected:  ${igResult.collected}`);
    console.log(`     Usable:     ${igResult.usable}`);
    console.log(`     Shortfall:  ${igResult.shortfall}`);
    console.log(`     Error:      ${igResult.error || 'None'}`);
    printCandidates('Instagram Reels', igResult.candidates);

    console.log('\n5. Executing Meta Ad Library Collector (Target: 20)...');
    const metaResult = await metaCollector.collect(queries, {
      targetCount: 20,
      searchId: `phase3b-live-meta-${i + 1}`,
    });

    console.log(`   [Meta Ad Library Collector Counts]`);
    console.log(`     Requested:  ${metaResult.requested}`);
    console.log(`     Collected:  ${metaResult.collected}`);
    console.log(`     Usable:     ${metaResult.usable}`);
    console.log(`     Shortfall:  ${metaResult.shortfall}`);
    console.log(`     Error:      ${metaResult.error || 'None'}`);
    printCandidates('Meta Ad Library Ads', metaResult.candidates);

    console.log('\n------------------------------------------------------------------------');
    console.log(`PRODUCT ${i + 1} SUMMARY EVALUATION:`);
    console.log(`  Instagram Reached 20? ${igResult.usable >= 20 ? 'YES' : `NO (Yield: ${igResult.usable}/20, Shortfall: ${igResult.shortfall})`}`);
    console.log(`  Meta Ads Reached 20?  ${metaResult.usable >= 20 ? 'YES' : `NO (Yield: ${metaResult.usable}/20, Shortfall: ${metaResult.shortfall})`}`);
    console.log('------------------------------------------------------------------------\n');
  }

  await closeDb();
  await stopEmbeddedPostgres();
  console.log('Live check completed successfully.');
}

runLiveCheck().catch((err) => {
  console.error('Fatal error during Phase 3b live check:', err);
  process.exit(1);
});
