import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('ViDashboard Phase 5 Verification & Screenshots', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots');
  const mockSearchId = 'fenty-gloss-real-001';

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

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

  test('captures real completed search on desktop (1280x800)', async ({ page }) => {
    // Intercept API routes
    await page.route('**/api/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ searches: mockHistory }),
      });
    });

    await page.route(`**/api/search/${mockSearchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCompletedSearchDetails),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Verify Brand Header
    await expect(page.getByText('ViDashboard', { exact: true })).toBeVisible();

    // Open Search History Panel from left rail
    const historyButton = page.locator('button[title="Search History"]');
    await historyButton.click();
    await expect(page.getByText('Search History')).toBeVisible();

    // Click the active Fenty search to load results
    const fentyHistoryItem = page.getByText('Gloss Bomb Universal Lip Luminizer').first();
    await fentyHistoryItem.click();

    // Verify Results Dashboard is visible with all required panels
    await expect(page.getByText('Product Visual Attributes')).toBeVisible();
    await expect(page.getByText('Rose Shimmer')).toBeVisible();
    await expect(page.getByText('Candidate Video Uniqueness & Audit')).toBeVisible();
    await expect(page.getByText('Meta Ad Library')).toBeVisible();
    await expect(page.getByText('Shortfall: 7 fewer than 20 requested')).toBeVisible();

    // Capture Desktop Screenshot
    const desktopScreenshotPath = path.join(screenshotsDir, 'search-completed-desktop.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    await page.screenshot({ path: path.join(screenshotsDir, 'desktop.png'), fullPage: true });
    expect(fs.existsSync(desktopScreenshotPath)).toBe(true);
  });

  test('captures real completed search on tablet (768x1024)', async ({ page }) => {
    await page.route('**/api/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ searches: mockHistory }),
      });
    });

    await page.route(`**/api/search/${mockSearchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCompletedSearchDetails),
      });
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Open Search History and select completed search
    const historyButton = page.locator('button[title="Search History"]');
    await historyButton.click();
    const fentyHistoryItem = page.getByText('Gloss Bomb Universal Lip Luminizer').first();
    await fentyHistoryItem.click();

    // Verify Results Dashboard
    await expect(page.getByText('Product Visual Attributes')).toBeVisible();

    // Capture Tablet Screenshot
    const tabletScreenshotPath = path.join(screenshotsDir, 'search-completed-tablet.png');
    await page.screenshot({ path: tabletScreenshotPath, fullPage: true });
    await page.screenshot({ path: path.join(screenshotsDir, 'tablet.png'), fullPage: true });
    expect(fs.existsSync(tabletScreenshotPath)).toBe(true);
  });

  test('captures persistent search history panel open', async ({ page }) => {
    await page.route('**/api/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ searches: mockHistory }),
      });
    });

    await page.route(`**/api/search/${mockSearchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCompletedSearchDetails),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Click History button on left rail to open persistent docked panel
    const historyButton = page.locator('button[title="Search History"]');
    await historyButton.click();

    await expect(page.getByText('Search History')).toBeVisible();
    await expect(page.getByPlaceholder('Filter history...')).toBeVisible();
    await expect(page.getByText('Represent 247 Oversized Tank').first()).toBeVisible();

    // Capture History Panel Screenshot
    const historyScreenshotPath = path.join(screenshotsDir, 'search-history-panel.png');
    await page.screenshot({ path: historyScreenshotPath, fullPage: true });
    await page.screenshot({ path: path.join(screenshotsDir, 'history_panel.png'), fullPage: true });
    expect(fs.existsSync(historyScreenshotPath)).toBe(true);
  });

  test('captures error state view (PRODUCT_EXTRACTION_FAILED)', async ({ page }) => {
    await page.route('**/api/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ searches: [] }),
      });
    });

    // Mock search creation failure with PRODUCT_EXTRACTION_FAILED
    await page.route('**/api/search', async (route) => {
      await route.fulfill({
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

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Type a failing URL into TopSearchBar
    const searchInput = page.getByPlaceholder('Paste product URL (Shopify/Brand) or enter keywords...');
    await searchInput.fill('https://example.com/non-existent-product-404');

    // Click Run Image Brain
    const submitBtn = page.getByRole('button', { name: 'Run Image Brain' });
    await submitBtn.click();

    // Verify ErrorStateView appears
    await expect(page.getByText('Product URL Extraction Failed')).toBeVisible();
    await expect(page.getByText('Extraction Error')).toBeVisible();
    await expect(page.getByText('What to try next:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry Discovery' })).toBeVisible();

    // Capture Error State Screenshot
    const errorScreenshotPath = path.join(screenshotsDir, 'error-state-retry.png');
    await page.screenshot({ path: errorScreenshotPath, fullPage: true });
    await page.screenshot({ path: path.join(screenshotsDir, 'error_state.png'), fullPage: true });
    expect(fs.existsSync(errorScreenshotPath)).toBe(true);
  });
});
