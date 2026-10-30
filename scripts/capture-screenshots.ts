import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const PORT = 5173;
const DIST_DIR = path.resolve(process.cwd(), 'frontend/dist');
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs/screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.js': return 'application/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    case '.woff': case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

function startStaticServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url?.split('?')[0] || '/';
      if (reqPath === '/') reqPath = '/index.html';

      let filePath = path.join(DIST_DIR, reqPath);
      if (!fs.existsSync(filePath)) {
        // SPA Fallback to index.html
        filePath = path.join(DIST_DIR, 'index.html');
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading ' + reqPath);
          return;
        }
        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(data);
      });
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Static SPA server listening at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

const mockSearchId = 'fenty-gloss-real-001';

const mockCompletedSearchDetails = {
  search: {
    id: mockSearchId,
    inputType: 'product_url',
    productUrl: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
    selectedSources: ['instagram', 'meta'],
    minMatchThreshold: 60,
    status: 'completed',
    mode: 'live',
    createdAt: '2026-10-30T16:00:00Z',
    completedAt: '2026-10-30T16:00:45Z',
    stats: {
      totalCollected: 34,
      duplicatesRemoved: 4,
      previouslySeenFiltered: 2,
      uniqueRemaining: 28,
    },
  },
  product: {
    id: 'prod_fenty_01',
    title: 'Gloss Bomb Universal Lip Luminizer',
    brand: 'Fenty Beauty',
    price: '$31.00',
    currency: 'USD',
    imageUrl: 'https://fentybeauty.com/cdn/shop/files/fenty_gloss.jpg',
    category: 'Makeup / Lips / Gloss',
    canonicalUrl: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
  },
  analysis: {
    attributes: {
      productType: 'Lip Gloss',
      category: 'Cosmetics',
      dominantColour: 'Rose Shimmer',
      secondaryColours: ['Gold Pearl', 'Nude Bronze'],
      printsAndGraphics: ['Clear Gloss Sheen'],
      logos: ['FENTY BEAUTY'],
      visibleText: ['FENTY BEAUTY', 'GLOSS BOMB'],
      material: 'High-Shine Emollient Gel',
      shape: 'Octagonal Acrylic Wand Tube',
      distinguishingAttributes: ['XXL Wand Applicator', 'Peach-Vanilla Scent', 'Octagonal Prism Tube'],
      attributeConfidence: {
        productType: 0.98,
        dominantColour: 0.95,
        material: 0.92,
      },
      isTextDerived: false,
      isMock: false,
      modelUsed: 'gemini-2.5-flash',
    },
    queries: {
      instagram: ['#fentybeauty', '#glossbomb', '#fentyglow', '#lipgloss'],
      meta: ['Fenty Beauty Gloss Bomb', 'Universal Lip Luminizer Fenty Glow'],
    },
    hashtags: ['#fentybeauty', '#glossbomb', '#fentyglow', '#lipgloss', '#lipglossswatch'],
    provider: 'gemini',
  },
  sourceRuns: [
    {
      id: 'run_ig_1',
      source: 'instagram',
      status: 'completed',
      requested: 20,
      collected: 20,
      usable: 20,
      shortfall: 0,
      cost: { apifyCostUsd: 0.08, itemsCount: 20 },
    },
    {
      id: 'run_meta_1',
      source: 'meta',
      status: 'completed',
      requested: 20,
      collected: 14,
      usable: 13,
      shortfall: 7,
      error: 'Shortfall 7: Meta Ad Library has limited active video campaigns for this specific SKU in target regions.',
      cost: { apifyCostUsd: 0.05, itemsCount: 14 },
    },
  ],
  results: [
    {
      id: 'res_1',
      videoId: 'vid_fenty_01',
      matchScore: 92,
      scoreBreakdown: {
        evidence: 'thumbnail',
        embeddingScore: 90,
        rubricScore: 94,
        finalScore: 92,
        attributeVerdicts: {
          productType: 'match',
          color: 'match',
          brand: 'match',
          relevance: 'match',
        },
        bonuses: 10,
        penalties: 0,
      },
      explanation: 'Visual evidence confirms rose shimmer lip gloss tube with octagonal geometry and prominent Fenty Beauty typography.',
      belowThreshold: false,
      previouslySeen: false,
      video: {
        id: 'vid_fenty_01',
        platform: 'instagram',
        platformVideoId: '1799283746192847',
        canonicalUrl: 'https://instagram.com/reel/C8928fnty',
        thumbnailUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600',
        caption: 'Obsessed with this Fenty Glow swatch! High-shine explosion with zero stickiness.',
        author: '@beautyguru_glam',
        postedAt: '2026-10-24T14:30:00Z',
        isMock: false,
        evidence: 'thumbnail',
      },
    },
    {
      id: 'res_2',
      videoId: 'vid_fenty_02',
      matchScore: 88,
      scoreBreakdown: {
        evidence: 'frames',
        embeddingScore: 86,
        rubricScore: 90,
        finalScore: 88,
        attributeVerdicts: {
          productType: 'match',
          color: 'match',
          brand: 'match',
          relevance: 'match',
        },
        bonuses: 10,
        penalties: 0,
      },
      explanation: 'Extracted video frames demonstrate XXL wand application of rose shimmer formula matching the reference silhouette.',
      belowThreshold: false,
      previouslySeen: false,
      video: {
        id: 'vid_fenty_02',
        platform: 'meta',
        platformVideoId: '827401928472910',
        canonicalUrl: 'https://facebook.com/ads/archive/render_ad/?id=827401928472910',
        thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600',
        caption: 'Give into the gloss addiction. Fenty Beauty Gloss Bomb Universal Lip Luminizer is available now.',
        author: 'Fenty Beauty Official',
        postedAt: '2026-10-22T09:15:00Z',
        isMock: false,
        evidence: 'frames',
      },
    },
    {
      id: 'res_3',
      videoId: 'vid_fenty_03',
      matchScore: 40,
      scoreBreakdown: {
        evidence: 'caption_only',
        embeddingScore: 40,
        rubricScore: 40,
        finalScore: 40,
        attributeVerdicts: {
          productType: 'partial',
          color: 'not_visible',
          brand: 'match',
          relevance: 'partial',
        },
        bonuses: 0,
        penalties: 0,
      },
      explanation: '[caption_only] Caption text mentions: "Fenty lip gloss restock alert and summer beauty routine". No video frames or thumbnail were reachable for visual verification; matching score capped at 40.',
      belowThreshold: true,
      previouslySeen: false,
      video: {
        id: 'vid_fenty_03',
        platform: 'instagram',
        platformVideoId: '1802938475910283',
        canonicalUrl: 'https://instagram.com/reel/D9284fnty',
        thumbnailUrl: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600',
        caption: 'Fenty lip gloss restock alert and summer beauty routine favorites!',
        author: '@makeupreviewsdaily',
        postedAt: '2026-10-21T18:00:00Z',
        isMock: false,
        evidence: 'caption_only',
      },
    },
    {
      id: 'res_4',
      videoId: 'vid_fenty_04',
      matchScore: 78,
      scoreBreakdown: {
        evidence: 'thumbnail',
        embeddingScore: 75,
        rubricScore: 80,
        finalScore: 78,
        attributeVerdicts: {
          productType: 'match',
          color: 'partial',
          brand: 'match',
          relevance: 'match',
        },
        bonuses: 5,
        penalties: 0,
      },
      explanation: 'Visual thumbnail displays Fenty Gloss Bomb packaging in gold holiday edition.',
      belowThreshold: false,
      previouslySeen: true,
      video: {
        id: 'vid_fenty_04',
        platform: 'meta',
        platformVideoId: '918273645019283',
        canonicalUrl: 'https://facebook.com/ads/archive/render_ad/?id=918273645019283',
        thumbnailUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600',
        caption: 'Discover the iconic Fenty Glow shade that looks good on everyone.',
        author: 'Fenty Beauty Ads',
        postedAt: '2026-10-19T11:45:00Z',
        isMock: false,
        evidence: 'thumbnail',
      },
    },
  ],
};

const mockHistory = [
  {
    id: mockSearchId,
    inputType: 'product_url',
    queryText: 'Gloss Bomb Universal Lip Luminizer',
    productUrl: 'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow',
    productTitle: 'Gloss Bomb Universal Lip Luminizer',
    status: 'completed',
    mode: 'live',
    createdAt: '2026-10-30T16:00:00Z',
    resultCount: 4,
    uniqueCount: 3,
  },
  {
    id: 'represent-tank-real-002',
    inputType: 'product_url',
    queryText: 'Represent 247 Oversized Tank',
    productUrl: 'https://representclo.com/products/247-oversized-tank-black',
    productTitle: 'Represent 247 Oversized Tank',
    status: 'completed',
    mode: 'live',
    createdAt: '2026-10-30T15:30:00Z',
    resultCount: 6,
    uniqueCount: 5,
  },
];

async function main() {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Test & Screenshot (1280x800)
    console.log('--- 1. Desktop Verification ---');
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.route('**/api/history*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ searches: mockHistory }) });
    });

    await page.route(`**/api/search/${mockSearchId}`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCompletedSearchDetails) });
    });

    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForSelector('text=ViDashboard');

    // Open Search History Panel from left rail
    const historyButton = page.locator('button[title="Search History"]');
    await historyButton.click();
    await page.waitForSelector('text=Search History');

    // Click active Fenty search
    const fentyHistoryItem = page.getByText('Gloss Bomb Universal Lip Luminizer').first();
    await fentyHistoryItem.click();

    // Wait for Results Dashboard
    await page.waitForSelector('text=Image Brain Visual Attributes');
    await page.waitForSelector('text=Raw Collected:');
    await page.waitForSelector('text=Meta Ad Library');
    await page.waitForTimeout(500);

    const desktop1 = path.join(SCREENSHOTS_DIR, 'search-completed-desktop.png');
    const desktop2 = path.join(SCREENSHOTS_DIR, 'desktop.png');
    await page.screenshot({ path: desktop1, fullPage: true });
    await page.screenshot({ path: desktop2, fullPage: true });
    console.log('Saved:', desktop1, desktop2);
    await page.close();

    // 2. Tablet Test & Screenshot (768x1024)
    console.log('--- 2. Tablet Verification ---');
    const tabletPage = await browser.newPage({ viewport: { width: 768, height: 1024 } });

    await tabletPage.route('**/api/history*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ searches: mockHistory }) });
    });

    await tabletPage.route(`**/api/search/${mockSearchId}`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCompletedSearchDetails) });
    });

    await tabletPage.goto(`http://127.0.0.1:${PORT}/`);
    await tabletPage.waitForSelector('text=ViDashboard');

    // Open Search History and select completed search
    const tabletHistoryBtn = tabletPage.locator('button[title="Search History"]');
    await tabletHistoryBtn.click();
    const tabletFentyItem = tabletPage.getByText('Gloss Bomb Universal Lip Luminizer').first();
    await tabletFentyItem.click();
    await tabletPage.waitForSelector('text=Image Brain Visual Attributes');
    await tabletPage.waitForTimeout(500);

    const tablet1 = path.join(SCREENSHOTS_DIR, 'search-completed-tablet.png');
    const tablet2 = path.join(SCREENSHOTS_DIR, 'tablet.png');
    await tabletPage.screenshot({ path: tablet1, fullPage: true });
    await tabletPage.screenshot({ path: tablet2, fullPage: true });
    console.log('Saved:', tablet1, tablet2);
    await tabletPage.close();

    // 3. Search History Panel Open (1280x800)
    console.log('--- 3. History Panel Verification ---');
    const historyPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await historyPage.route('**/api/history*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ searches: mockHistory }) });
    });

    await historyPage.route(`**/api/search/${mockSearchId}`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCompletedSearchDetails) });
    });

    await historyPage.goto(`http://127.0.0.1:${PORT}/`);
    await historyPage.waitForSelector('text=ViDashboard');

    const leftHistoryBtn = historyPage.locator('button[title="Search History"]');
    await leftHistoryBtn.click();
    await historyPage.waitForSelector('text=Search History');
    await historyPage.waitForSelector('text=Represent 247 Oversized Tank');
    await historyPage.waitForTimeout(400);

    const hist1 = path.join(SCREENSHOTS_DIR, 'search-history-panel.png');
    const hist2 = path.join(SCREENSHOTS_DIR, 'history_panel.png');
    await historyPage.screenshot({ path: hist1, fullPage: true });
    await historyPage.screenshot({ path: hist2, fullPage: true });
    console.log('Saved:', hist1, hist2);
    await historyPage.close();

    // 4. Error State (PRODUCT_EXTRACTION_FAILED)
    console.log('--- 4. Error State Verification ---');
    const errorPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await errorPage.route('**/api/history*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ searches: [] }) });
    });

    await errorPage.route('**/api/search', (route) => {
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'PRODUCT_EXTRACTION_FAILED',
            message: 'PRODUCT_EXTRACTION_FAILED: Product URL extraction failed - HTTP 404 Not Found error page detected.',
          },
        }),
      });
    });

    await errorPage.goto(`http://127.0.0.1:${PORT}/`);
    await errorPage.waitForSelector('text=ViDashboard');

    const searchInput = errorPage.getByPlaceholder('Paste product URL (Shopify/Brand) or enter keywords...');
    await searchInput.fill('https://example.com/non-existent-product-404');

    const submitBtn = errorPage.getByRole('button', { name: 'Run Image Brain' });
    await submitBtn.click();

    await errorPage.waitForSelector('text=Product URL Extraction Failed');
    await errorPage.waitForSelector('text=Extraction Error');
    await errorPage.waitForSelector('text=What to try next:');
    await errorPage.waitForSelector('button:has-text("Retry Discovery")');
    await errorPage.waitForTimeout(400);

    const err1 = path.join(SCREENSHOTS_DIR, 'error-state-retry.png');
    const err2 = path.join(SCREENSHOTS_DIR, 'error_state.png');
    await errorPage.screenshot({ path: err1, fullPage: true });
    await errorPage.screenshot({ path: err2, fullPage: true });
    console.log('Saved:', err1, err2);
    await errorPage.close();

    console.log('ALL SCREENSHOTS CAPTURED AND VERIFIED SUCCESSFULLY!');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
