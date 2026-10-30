import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('ViDashboard E2E Smoke Test', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('loads dashboard, takes desktop & tablet screenshots, and verifies discovery flow', async ({ page }) => {
    // 1. Mock the API endpoints for fast, deterministic E2E verification
    const mockSearchId = 'e2e-search-smoke-1234';

    await page.route('/api/search', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          searchId: mockSearchId,
          status: 'pending',
          inputType: 'product_url',
        }),
      });
    });

    await page.route(`/api/search/${mockSearchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          search: {
            id: mockSearchId,
            inputType: 'product_url',
            productUrl: 'https://fentybeauty.com/products/gloss-bomb',
            selectedSources: ['instagram', 'meta'],
            minMatchThreshold: 60,
            status: 'completed',
            mode: 'live',
            createdAt: new Date().toISOString(),
          },
          product: {
            id: 'prod_fenty',
            title: 'Gloss Bomb Universal Lip Luminizer',
            brand: 'Fenty Beauty',
            price: '31.00',
            currency: 'USD',
            imageUrl: 'https://fentybeauty.com/cdn/shop/files/fenty_gloss.jpg',
            category: 'Beauty / Makeup / Lip Gloss',
          },
          analysis: {
            attributes: {
              productType: 'Lip Gloss',
              dominantColour: 'Rose Shimmer',
              material: 'Liquid Gloss',
              shape: 'Octagonal Tube',
            },
          },
          sourceRuns: [
            { id: 'run_ig', source: 'instagram', status: 'completed', requested: 20, collected: 20, usable: 20, shortfall: 0 },
            { id: 'run_meta', source: 'meta', status: 'completed', requested: 20, collected: 20, usable: 20, shortfall: 0 },
          ],
          results: [
            {
              id: 'res_1',
              videoId: 'vid_1',
              matchScore: 94,
              scoreBreakdown: {
                evidence: 'thumbnail',
                embeddingScore: 92,
                rubricScore: 96,
                finalScore: 94,
                attributeVerdicts: {
                  productType: 'match',
                  color: 'match',
                  brand: 'match',
                  relevance: 'match',
                },
                bonuses: 10,
                penalties: 0,
              },
              explanation: 'Visible product style matches Fenty Beauty Gloss Bomb Universal Lip Luminizer; brand verified.',
              belowThreshold: false,
              previouslySeen: false,
              video: {
                id: 'vid_1',
                platform: 'instagram',
                platformVideoId: 'reel_smoke_01',
                canonicalUrl: 'https://instagram.com/reel/smoke01',
                thumbnailUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400',
                caption: 'Authentic Fenty Beauty Gloss Bomb in Rose Shimmer swatch and wear test!',
                author: '@beautyguru',
                postedAt: '2026-10-20T10:00:00Z',
              },
            },
            {
              id: 'res_2',
              videoId: 'vid_2',
              matchScore: 82,
              scoreBreakdown: {
                evidence: 'frames',
                embeddingScore: 80,
                rubricScore: 84,
                finalScore: 82,
                attributeVerdicts: {
                  productType: 'match',
                  color: 'partial',
                  brand: 'match',
                  relevance: 'match',
                },
                bonuses: 10,
                penalties: 0,
              },
              explanation: 'Commercial video ad showcasing Fenty lip glow product line.',
              belowThreshold: false,
              previouslySeen: false,
              video: {
                id: 'vid_2',
                platform: 'meta',
                platformVideoId: 'meta_smoke_02',
                canonicalUrl: 'https://facebook.com/ads/smoke02',
                thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400',
                caption: 'Official Fenty Glow Luminizer campaign. High-shine explosion.',
                author: 'Fenty Beauty Official',
                postedAt: '2026-10-18T14:30:00Z',
              },
            },
          ],
        }),
      });
    });

    // 2. Desktop Viewport (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Verify Title & Header
    await expect(page.getByText('ViDashboard', { exact: true })).toBeVisible();
    await expect(page.getByText('Discover Product Videos & Ads')).toBeVisible();

    // Capture Desktop Screenshot
    const desktopScreenshotPath = path.join(screenshotsDir, 'desktop.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });

    // 3. Tablet Viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    const tabletScreenshotPath = path.join(screenshotsDir, 'tablet.png');
    await page.screenshot({ path: tabletScreenshotPath, fullPage: true });

    // Switch back to desktop for interactive flow
    await page.setViewportSize({ width: 1280, height: 800 });

    // 4. Fill and submit search
    await page.click('text=💄 Fenty Beauty Gloss');
    await expect(page.locator('input[id="product-webpage-url"]')).toHaveValue(
      'https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow'
    );

    // Click Launch
    await page.click('text=Launch Video Discovery Pipeline');

    // 5. Verify Stepper View
    await expect(page.locator('text=Pipeline Progress')).toBeVisible();
    await expect(page.locator('text=Resolving Product')).toBeVisible();
    await expect(page.locator('text=Calculating Visual Similarity')).toBeVisible();

    // Click "View Results"
    await page.click('text=View Results');

    // 6. Verify Results Dashboard
    await expect(page.locator('text=Video Match Intelligence Dashboard')).toBeVisible();
    await expect(page.locator('text=Gloss Bomb Universal Lip Luminizer')).toBeVisible();
    await expect(page.locator('text=94%')).toBeVisible();
    await expect(page.locator('text=82%')).toBeVisible();

    // Take Results Screenshot
    const resultsScreenshotPath = path.join(screenshotsDir, 'results_dashboard.png');
    await page.screenshot({ path: resultsScreenshotPath, fullPage: true });

    expect(fs.existsSync(desktopScreenshotPath)).toBe(true);
    expect(fs.existsSync(tabletScreenshotPath)).toBe(true);
    expect(fs.existsSync(resultsScreenshotPath)).toBe(true);
  });
});
