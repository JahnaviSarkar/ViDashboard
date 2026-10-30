import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsDashboardView } from '../features/results/ResultsDashboardView';
import { SearchDetails, CandidateResult } from '../types';

describe('ResultsDashboard Filters & Controls', () => {
  const mockCandidates: CandidateResult[] = [
    {
      id: 'res_ig_1',
      videoId: 'vid_ig_1',
      matchScore: 92,
      scoreBreakdown: {
        evidence: 'thumbnail',
        finalScore: 92,
        embeddingScore: 90,
        rubricScore: 95,
      },
      explanation: 'Matches lip gloss silhouette.',
      belowThreshold: false,
      previouslySeen: false,
      video: {
        id: 'vid_ig_1',
        platform: 'instagram',
        platformVideoId: 'ig_reel_1',
        canonicalUrl: 'https://instagram.com/reel/1',
        thumbnailUrl: 'https://example.com/ig1.jpg',
        caption: 'Fenty Beauty Gloss Bomb swatches',
        author: '@glamuser',
      },
    },
    {
      id: 'res_meta_2',
      videoId: 'vid_meta_2',
      matchScore: 74,
      scoreBreakdown: {
        evidence: 'frames',
        finalScore: 74,
        embeddingScore: 70,
        rubricScore: 78,
      },
      explanation: 'Ad video featuring lip gloss.',
      belowThreshold: false,
      previouslySeen: false,
      video: {
        id: 'vid_meta_2',
        platform: 'meta',
        platformVideoId: 'meta_ad_2',
        canonicalUrl: 'https://facebook.com/ads/2',
        thumbnailUrl: 'https://example.com/meta2.jpg',
        caption: 'Summer cosmetics clearance event',
        author: 'Beauty Store',
      },
    },
    {
      id: 'res_meta_low',
      videoId: 'vid_meta_low',
      matchScore: 45,
      scoreBreakdown: {
        evidence: 'caption_only',
        finalScore: 45,
      },
      explanation: 'Limited overlap.',
      belowThreshold: true,
      previouslySeen: false,
      video: {
        id: 'vid_meta_low',
        platform: 'meta',
        platformVideoId: 'meta_ad_low',
        canonicalUrl: 'https://facebook.com/ads/low',
        caption: 'Unrelated automotive accessories sale',
        author: 'Auto Zone',
      },
    },
  ];

  const mockSearchDetails: SearchDetails = {
    search: {
      id: 'search_test_1',
      inputType: 'product_url',
      selectedSources: ['instagram', 'meta'],
      minMatchThreshold: 60,
      status: 'completed',
      mode: 'mock',
      createdAt: '2026-10-15T10:00:00Z',
    },
    product: {
      id: 'prod_1',
      title: 'Gloss Bomb Universal Lip Luminizer',
      brand: 'Fenty Beauty',
      price: '31.00',
      currency: 'USD',
      imageUrl: 'https://example.com/product.jpg',
    },
    analysis: {
      attributes: {
        productType: 'Lip Gloss',
        category: 'Beauty',
        dominantColour: 'Rose Shimmer',
      },
    },
    sourceRuns: [
      { id: 'run_1', source: 'instagram', status: 'completed', requested: 20, collected: 20, usable: 20, shortfall: 0 },
      { id: 'run_2', source: 'meta', status: 'completed', requested: 20, collected: 20, usable: 20, shortfall: 0 },
    ],
    results: mockCandidates,
  };

  it('renders all candidates scoring above initial threshold (60%)', () => {
    const onNewSearch = vi.fn();
    const onToggleShortlist = vi.fn();
    render(
      <ResultsDashboardView
        searchDetails={mockSearchDetails}
        onNewSearch={onNewSearch}
        shortlist={[]}
        onToggleShortlist={onToggleShortlist}
      />
    );

    // Candidate 1 (92%) and Candidate 2 (74%) should be visible; Candidate 3 (45%) is filtered out
    expect(screen.getByText('92%')).toBeDefined();
    expect(screen.getByText('74%')).toBeDefined();
    expect(screen.queryByText('45%')).toBeNull();
  });

  it('filters candidates by source tab', () => {
    const onNewSearch = vi.fn();
    const onToggleShortlist = vi.fn();
    render(
      <ResultsDashboardView
        searchDetails={mockSearchDetails}
        onNewSearch={onNewSearch}
        shortlist={[]}
        onToggleShortlist={onToggleShortlist}
      />
    );

    // Click Meta Ad Library pill
    const metaTab = screen.getByText('Meta Ad Library');
    fireEvent.click(metaTab);

    // Only Meta candidate should remain (74%), Instagram (92%) should not be in the grid
    expect(screen.getByText('74%')).toBeDefined();
    expect(screen.queryByText('92%')).toBeNull();
  });

  it('filters candidates by keyword search text', () => {
    const onNewSearch = vi.fn();
    const onToggleShortlist = vi.fn();
    render(
      <ResultsDashboardView
        searchDetails={mockSearchDetails}
        onNewSearch={onNewSearch}
        shortlist={[]}
        onToggleShortlist={onToggleShortlist}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search keywords, authors, or captions in results...');
    fireEvent.change(searchInput, { target: { value: 'clearance' } });

    // Only Candidate 2 has "clearance" in caption
    expect(screen.getByText('74%')).toBeDefined();
    expect(screen.queryByText('92%')).toBeNull();
  });
});

