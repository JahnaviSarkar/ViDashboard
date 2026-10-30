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

export type PipelineEventStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PipelineEvent {
  id: number;
  searchId: string;
  stage: PipelineStage;
  status: PipelineEventStatus;
  payload: Record<string, any>;
  createdAt: string;
}

export interface ScoreBreakdown {
  evidence?: 'frames' | 'thumbnail' | 'caption_only';
  embeddingScore?: number;
  rubricScore?: number;
  finalScore: number;
  attributeVerdicts?: Record<string, 'match' | 'partial' | 'mismatch' | 'not_visible'>;
  bonuses?: number;
  penalties?: number;
}

export interface CandidateResult {
  id: string;
  videoId: string;
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
  explanation: string;
  belowThreshold: boolean;
  previouslySeen: boolean;
  duplicateOf?: string | null;
  rank?: number | null;
  video: {
    id: string;
    platform: 'instagram' | 'meta';
    platformVideoId: string;
    canonicalUrl: string;
    thumbnailUrl?: string;
    mediaUrl?: string;
    caption?: string;
    author?: string;
    postedAt?: string;
    isMock?: boolean;
    evidence?: 'frames' | 'thumbnail' | 'caption_only';
    framePaths?: string[];
  };
}

export interface ProductDetails {
  id: string;
  title: string;
  brand?: string;
  category?: string;
  price?: string | null;
  currency?: string | null;
  imageUrl?: string;
  description?: string;
  canonicalUrl?: string;
}

export interface ProductAnalysis {
  productType: string;
  category: string;
  dominantColour: string;
  secondaryColours?: string[];
  printsAndGraphics?: string[];
  logos?: string[];
  visibleText?: string[];
  material?: string;
  shape?: string;
  distinguishingAttributes?: string[];
  attributeConfidence?: Record<string, number>;
  isTextDerived?: boolean;
  isMock?: boolean;
  modelUsed?: string;
}

export interface SourceRun {
  id: string;
  source: 'instagram' | 'meta';
  status: string;
  requested: number;
  collected: number;
  usable: number;
  shortfall: number;
  error?: string | null;
  cost?: {
    apifyCostUsd?: number;
    itemsCount?: number;
  } | null;
}

export interface SearchDetails {
  search: {
    id: string;
    inputType: 'product_url' | 'keyword' | 'image_upload';
    productUrl?: string;
    queryText?: string;
    selectedSources: Array<'instagram' | 'meta'>;
    minMatchThreshold: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    mode: 'live' | 'mock';
    createdAt: string;
    completedAt?: string;
  };
  product?: ProductDetails | null;
  analysis?: {
    attributes: ProductAnalysis;
    queries?: Record<string, any>;
    hashtags?: string[];
    provider?: string;
  } | null;
  sourceRuns: SourceRun[];
  results: CandidateResult[];
}

export interface SearchItemSummary {
  id: string;
  inputType: string;
  queryText?: string;
  productUrl?: string;
  status: string;
  mode: string;
  createdAt: string;
  productTitle?: string;
  resultCount?: number;
}
