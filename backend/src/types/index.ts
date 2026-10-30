export type Platform = 'instagram' | 'meta' | 'tiktok';

export type SearchStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type PipelineStage =
  | 'resolving_product'
  | 'extracting_product_image'
  | 'analysing_product_image'
  | 'generating_search_queries'
  | 'fetching_instagram'
  | 'fetching_meta'
  | 'extracting_video_frames'
  | 'calculating_visual_similarity'
  | 'removing_duplicates'
  | 'preparing_final_results';

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
  evidence?: 'frames' | 'thumbnail' | 'caption_only';
  framePaths?: string[];
  frameBuffers?: Buffer[];
  isMock: boolean;
  raw?: Record<string, unknown>;
}

export interface ScoreBreakdown {
  evidence: 'frames' | 'thumbnail' | 'caption_only';
  embeddingScore?: number;
  rubricScore?: number;
  finalScore: number;
  evidenceFrame?: string;
  attributeVerdicts?: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'>;
  penalties?: number;
  bonuses?: number;
}
