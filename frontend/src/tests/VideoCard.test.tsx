import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCard } from '../features/results/VideoCard';
import { CandidateResult } from '../types';

describe('VideoCard Component', () => {
  const mockResult: CandidateResult = {
    id: 'res_1',
    videoId: 'vid_1',
    matchScore: 88,
    scoreBreakdown: {
      evidence: 'thumbnail',
      embeddingScore: 85,
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
    explanation: 'Visible product style matches Fenty Beauty Gloss Bomb; brand verified.',
    belowThreshold: false,
    previouslySeen: false,
    video: {
      id: 'vid_1',
      platform: 'instagram',
      platformVideoId: 'reel_123',
      canonicalUrl: 'https://instagram.com/reel/reel_123',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      caption: 'Loving this gorgeous rose shimmer lip gloss swatch!',
      author: '@beautyguru',
      postedAt: '2026-10-15T12:00:00Z',
    },
  };

  it('renders platform badge, match score, and author handle', () => {
    const onPreview = vi.fn();
    render(<VideoCard result={mockResult} onOpenPreview={onPreview} />);

    expect(screen.getByText('88%')).toBeDefined();
    expect(screen.getByText('@beautyguru')).toBeDefined();
    expect(screen.getByText('thumbnail')).toBeDefined();
  });

  it('triggers onOpenPreview when clicking the card', () => {
    const onPreview = vi.fn();
    const { container } = render(<VideoCard result={mockResult} onOpenPreview={onPreview} />);

    // Click card container
    const card = container.querySelector('.card');
    expect(card).toBeDefined();
    if (card) {
      fireEvent.click(card);
      expect(onPreview).toHaveBeenCalledWith(mockResult);
    }
  });

  it('displays "Rubric" popover on click with visual citation', () => {
    const onPreview = vi.fn();
    render(<VideoCard result={mockResult} onOpenPreview={onPreview} />);

    const popoverTrigger = screen.getByText('Rubric');
    expect(popoverTrigger).toBeDefined();
    fireEvent.click(popoverTrigger);

    // Popover content should be visible
    expect(screen.getByText('Visual Evidence & Rubric')).toBeDefined();
    expect(screen.getByText('Visible product style matches Fenty Beauty Gloss Bomb; brand verified.')).toBeDefined();
    expect(screen.getByText('Cosine: 85%')).toBeDefined();
    expect(screen.getByText('Rubric: 90%')).toBeDefined();
  });
});

