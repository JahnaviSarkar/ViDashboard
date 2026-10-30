export type Platform = 'instagram' | 'meta' | 'tiktok';

export type SearchStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PipelineStage =
  | 'resolving_product'
  | 'extracting_image'
  | 'analysing_image'
  | 'generating_queries'
  | 'fetching_instagram'
  | 'fetching_meta'
  | 'extracting_frames'
  | 'calculating_similarity'
  | 'removing_duplicates'
  | 'finalizing_results';

export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface CandidateVideo {
  id: string;
  platform: Platform;
  platformVideoId: string;
  canonicalUrl: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  caption?: string;
  author?: string;
  postedAt?: Date;
  mediaPhash?: string;
  embedding?: number[];
  isMock: boolean;
  raw?: Record<string, unknown>;
}

export interface ScoreBreakdown {
  embeddingScore?: number;
  rubricScore?: number;
  finalScore: number;
  evidenceFrame?: string;
  attributeVerdicts?: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'>;
  penalties?: number;
  bonuses?: number;
}
