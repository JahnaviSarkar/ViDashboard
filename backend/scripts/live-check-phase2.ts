import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensurePostgresRunning, stopEmbeddedPostgres } from '../src/db/embedded-helper';
import { runMigrations } from '../src/db/migrate';
import { closeDb } from '../src/db';
import { ProductResolverService } from '../src/services/product-resolver.service';
import { getVisionProvider } from '../src/providers/vision';
import { QueryGeneratorService } from '../src/services/query-generator.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('===============================================================');
  console.log('ViDashboard - Phase 2 Live Verification Check');
  console.log('===============================================================\n');

  await ensurePostgresRunning();
  await runMigrations();

  const resolver = new ProductResolverService();
  const visionProvider = getVisionProvider();
  const queryGenerator = new QueryGeneratorService();

  console.log(`Active Vision Provider: ${visionProvider.name}\n`);

  const targets = [
    {
      label: '(a) Same Fenty URL',
      url: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
    },
    {
      label: '(b) Same Anker URL',
      url: 'https://www.anker.com/products/a3102',
    },
    {
      label: '(c-1) NEW Real Product: Shopify Fashion (Represent Clothing)',
      url: 'https://representclo.com/products/247-oversized-tank-26-jet-black',
    },
    {
      label: '(c-2) NEW Real Product: Amazon India',
      url: 'https://www.amazon.in/dp/B08L5V9T31',
    },
  ];

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    console.log(`--- [Target ${i + 1}/${targets.length}] ${item.label} ---`);
    console.log(`  URL:         ${item.url}`);

    try {
      const resolved = await resolver.resolve(item.url);
      console.log(`  Status:      RESOLVED_SUCCESS`);
      console.log(`  Title:       ${resolved.title}`);
      console.log(`  Brand:       ${resolved.brand || 'N/A'}`);
      console.log(`  Price:       ${resolved.price !== undefined ? `${resolved.currency || '$'} ${resolved.price}` : 'N/A'}`);
      console.log(`  Image URL:   ${resolved.imageUrl || 'None'}`);
      console.log(`  Image Hash:  ${resolved.imageHash ? resolved.imageHash.slice(0, 16) + '...' : 'None'}`);

      console.log('  [Image Brain Analysis via Gemini Vision]:');
      const analysis = await visionProvider.analyze({
        title: resolved.title,
        description: resolved.description,
        imageUrl: resolved.imageUrl,
        imageBuffer: resolved.imageBuffer,
      });

      console.log(`    isMock:          ${analysis.isMock}`);
      console.log(`    Product Type:    ${analysis.productType}`);
      console.log(`    Category:        ${analysis.category}`);
      console.log(`    Dominant Colour: ${analysis.dominantColour}`);
      console.log(`    Secondary:       ${analysis.secondaryColours.join(', ') || 'None'}`);
      console.log(`    Material:        ${analysis.material}`);
      console.log(`    Shape:           ${analysis.shape}`);
      console.log(`    Logos:           ${analysis.logos.join(', ') || 'None'}`);
      console.log(`    Visible Text:    ${analysis.visibleText.join(', ') || 'None'}`);
      console.log(`    Attributes:      ${analysis.distinguishingAttributes.join(', ')}`);
      console.log(`    Confidence:      ${JSON.stringify(analysis.attributeConfidence)}`);
      console.log(`    Text-derived?:   ${analysis.isTextDerived}`);

      const queries = queryGenerator.generate(analysis, resolved.brand);
      console.log('  [Generated Queries & Hashtags]:');
      console.log(`    Instagram Tags:  ${queries.instagram.hashtags.slice(0, 6).join(' ')}`);
      console.log(`    Meta Terms:      ${queries.meta.searchTerms.slice(0, 3).join(' | ')}`);
      console.log(`    Tier 1 (Exact):  ${queries.expansionTiers.tier1.slice(0, 2).join(' | ')}`);
      console.log(`    Tier 2 (Broad):  ${queries.expansionTiers.tier2.slice(0, 2).join(' | ')}`);
      console.log(`    Tier 3 (Cat):    ${queries.expansionTiers.tier3.slice(0, 2).join(' | ')}\n`);
    } catch (err: any) {
      console.log(`  Status:      REJECTED / BLOCKED`);
      console.log(`  Error Code:  ${err.code || 'UNKNOWN_ERROR'}`);
      console.log(`  Message:     ${err.message}`);
      console.log(`  Retryable:   ${err.retryable ?? false}\n`);
    }
  }

  // (d) 1 keyword search
  console.log('--- [Target 5] (d) Keyword Search: "Ergonomic Mechanical Keyboard" ---');
  const kwAnalysis = await visionProvider.analyze({
    title: 'Ergonomic Split Mechanical Keyboard',
    description: 'Custom mechanical keyboard with hot-swappable switches, PBT keycaps, and RGB underglow',
  });
  const kwQueries = queryGenerator.generate(kwAnalysis);
  console.log('  [Image Brain Analysis via Gemini Vision]:');
  console.log(`    isMock:          ${kwAnalysis.isMock}`);
  console.log(`    Product Type:    ${kwAnalysis.productType}`);
  console.log(`    Category:        ${kwAnalysis.category}`);
  console.log(`    Dominant Colour: ${kwAnalysis.dominantColour}`);
  console.log(`    Material:        ${kwAnalysis.material}`);
  console.log(`    Shape:           ${kwAnalysis.shape}`);
  console.log(`    Attributes:      ${kwAnalysis.distinguishingAttributes.join(', ')}`);
  console.log(`    Confidence:      ${JSON.stringify(kwAnalysis.attributeConfidence)}`);
  console.log(`    Text-derived?:   ${kwAnalysis.isTextDerived}`);
  console.log('  [Generated Queries]:');
  console.log(`    Instagram Tags:  ${kwQueries.instagram.hashtags.slice(0, 6).join(' ')}`);
  console.log(`    Meta Terms:      ${kwQueries.meta.searchTerms.slice(0, 3).join(' | ')}\n`);

  // (e) 1 uploaded image
  console.log('--- [Target 6] (e) Uploaded Product Image: Red Athletic Running Shoes ---');
  const uploadImgPath = path.resolve(process.cwd(), 'uploads/sample-uploaded-product.jpg');
  let uploadImgBuffer: Buffer;
  if (fs.existsSync(uploadImgPath)) {
    uploadImgBuffer = fs.readFileSync(uploadImgPath);
    console.log(`  Loaded real image file (${uploadImgBuffer.length} bytes)`);
  } else {
    uploadImgBuffer = Buffer.from('FAKE_BYTES');
  }

  const uploadAnalysis = await visionProvider.analyze({
    title: 'Athletic Running Shoe',
    imageBuffer: uploadImgBuffer,
    imageMimeType: 'image/jpeg',
  });
  const uploadQueries = queryGenerator.generate(uploadAnalysis);
  console.log('  [Image Brain Analysis via Gemini Vision]:');
  console.log(`    isMock:          ${uploadAnalysis.isMock}`);
  console.log(`    Product Type:    ${uploadAnalysis.productType}`);
  console.log(`    Category:        ${uploadAnalysis.category}`);
  console.log(`    Dominant Colour: ${uploadAnalysis.dominantColour}`);
  console.log(`    Secondary:       ${uploadAnalysis.secondaryColours.join(', ')}`);
  console.log(`    Material:        ${uploadAnalysis.material}`);
  console.log(`    Shape:           ${uploadAnalysis.shape}`);
  console.log(`    Logos:           ${uploadAnalysis.logos.join(', ') || 'None'}`);
  console.log(`    Visible Text:    ${uploadAnalysis.visibleText.join(', ') || 'None'}`);
  console.log(`    Attributes:      ${uploadAnalysis.distinguishingAttributes.join(', ')}`);
  console.log(`    Confidence:      ${JSON.stringify(uploadAnalysis.attributeConfidence)}`);
  console.log(`    Text-derived?:   ${uploadAnalysis.isTextDerived}`);
  console.log('  [Generated Queries]:');
  console.log(`    Instagram Tags:  ${uploadQueries.instagram.hashtags.slice(0, 6).join(' ')}`);
  console.log(`    Meta Terms:      ${uploadQueries.meta.searchTerms.slice(0, 3).join(' | ')}\n`);

  console.log('===============================================================');
  console.log('Phase 2 Live Check Completed Successfully');
  console.log('===============================================================\n');

  await stopEmbeddedPostgres();
  await closeDb();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Live check failed:', err);
  try {
    await stopEmbeddedPostgres();
    await closeDb();
  } catch {}
  process.exit(1);
});
