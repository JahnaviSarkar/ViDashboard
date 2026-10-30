import { GeneratedQueries } from '../services/query-generator.service';

export interface RawVideoCandidate {
  platform: 'instagram' | 'meta' | 'tiktok';
  platformVideoId: string;
  canonicalUrl: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  caption?: string;
  author?: string;
  postedAt?: Date;
  mediaPhash?: string;
  embedding?: number[];
  raw?: Record<string, unknown>;
  isMock: boolean;
}

export interface CollectorOptions {
  targetCount?: number;
  searchId: string;
  timeoutMs?: number;
}

export interface CollectorResult {
  source: 'instagram' | 'meta' | 'tiktok';
  requested: number;
  collected: number;
  usable: number;
  shortfall: number;
  candidates: RawVideoCandidate[];
  error?: string;
}

export interface Collector {
  readonly source: 'instagram' | 'meta' | 'tiktok';
  collect(queries: GeneratedQueries, options: CollectorOptions): Promise<CollectorResult>;
}
