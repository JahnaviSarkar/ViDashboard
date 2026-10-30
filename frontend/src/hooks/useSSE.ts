import { useEffect, useState, useRef, useCallback } from 'react';
import { PipelineEvent, PipelineStage, PipelineEventStatus } from '../types';

export const PIPELINE_STAGES: { stage: PipelineStage; label: string; description: string }[] = [
  {
    stage: 'resolving_product',
    label: 'Resolving Product',
    description: 'Fetching target product URL metadata, microdata, or text signals',
  },
  {
    stage: 'extracting_product_image',
    label: 'Extracting Product Image',
    description: 'Retrieving canonical product imagery and computing perceptual hashes',
  },
  {
    stage: 'analysing_product_image',
    label: 'Analysing Visual Attributes',
    description: 'Running Image Brain VLM to extract color, material, logos, and silhouette',
  },
  {
    stage: 'generating_search_queries',
    label: 'Generating Search Queries',
    description: 'Synthesizing multi-tier platform hashtags and boolean search terms',
  },
  {
    stage: 'fetching_instagram',
    label: 'Fetching Instagram Reels',
    description: 'Collecting video reels matching product tags & keywords',
  },
  {
    stage: 'fetching_meta',
    label: 'Fetching Meta Ad Library',
    description: 'Searching active commercial video ad campaigns',
  },
  {
    stage: 'extracting_video_frames',
    label: 'Extracting Video Frames',
    description: 'Extracting representative video frames with ffmpeg and computing dHash',
  },
  {
    stage: 'calculating_visual_similarity',
    label: 'Calculating Visual Similarity',
    description: 'Evaluating hybrid semantic embeddings and vision rubric',
  },
  {
    stage: 'removing_duplicates',
    label: 'Removing Duplicates',
    description: 'Running near-duplicate clustering and cross-search seen video filtering',
  },
  {
    stage: 'preparing_final_results',
    label: 'Preparing Final Results',
    description: 'Ranking above-threshold candidates and compiling final audit stats',
  },
];

export interface StageState {
  stage: PipelineStage;
  status: PipelineEventStatus;
  payload?: Record<string, any>;
  durationMs?: number;
  lastUpdated?: string;
}

export interface UseSSEReturn {
  connectionStatus: 'connecting' | 'connected' | 'completed' | 'failed' | 'disconnected';
  stages: Record<PipelineStage, StageState>;
  events: PipelineEvent[];
  currentStage: PipelineStage | null;
  error: string | null;
  isComplete: boolean;
  reconnect: () => void;
}

export function useSSE(searchId?: string | null): UseSSEReturn {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'completed' | 'failed' | 'disconnected'>('disconnected');
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const isCompleteRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<number>(0);

  const [stages, setStages] = useState<Record<PipelineStage, StageState>>(() => {
    const initial: Partial<Record<PipelineStage, StageState>> = {};
    for (const item of PIPELINE_STAGES) {
      initial[item.stage] = { stage: item.stage, status: 'pending' };
    }
    return initial as Record<PipelineStage, StageState>;
  });

  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);

  const connect = useCallback(() => {
    if (!searchId || isCompleteRef.current) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus('connecting');
    setError(null);

    const sseUrl = `/api/search/${searchId}/events`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus('connected');
    };

    es.onerror = () => {
      // If completed, ignore
      if (isCompleteRef.current) return;
      setConnectionStatus('failed');
      setError('Connection interrupted. Reconnecting...');
    };

    // Generic message / custom event listeners for all 10 stages
    for (const item of PIPELINE_STAGES) {
      es.addEventListener(item.stage, (evt: MessageEvent) => {
        try {
          const parsed = JSON.parse(evt.data);
          const evId = evt.lastEventId ? Number(evt.lastEventId) : Date.now();
          lastEventIdRef.current = evId;

          const pipelineEvent: PipelineEvent = {
            id: evId,
            searchId: parsed.searchId || searchId,
            stage: item.stage,
            status: parsed.status,
            payload: parsed.payload || {},
            createdAt: parsed.createdAt || new Date().toISOString(),
          };

          setEvents((prev) => [...prev, pipelineEvent]);

          setStages((prev) => ({
            ...prev,
            [item.stage]: {
              stage: item.stage,
              status: parsed.status,
              payload: parsed.payload,
              durationMs: parsed.payload?.durationMs,
              lastUpdated: new Date().toISOString(),
            },
          }));

          if (parsed.status === 'running') {
            setCurrentStage(item.stage);
          } else if (parsed.status === 'failed') {
            setError(parsed.payload?.error?.message || `Stage ${item.label} failed`);
            setConnectionStatus('failed');
          }

          if (item.stage === 'preparing_final_results' && parsed.status === 'done') {
            isCompleteRef.current = true;
            setIsComplete(true);
            setConnectionStatus('completed');
            es.close();
          }
        } catch (e: any) {
          console.error('Failed to parse SSE payload:', e);
        }
      });
    }

    // Default message fallback
    es.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.stage) {
          const evId = evt.lastEventId ? Number(evt.lastEventId) : Date.now();
          lastEventIdRef.current = evId;
          const pipelineEvent: PipelineEvent = {
            id: evId,
            searchId: parsed.searchId || searchId,
            stage: parsed.stage,
            status: parsed.status,
            payload: parsed.payload || {},
            createdAt: parsed.createdAt || new Date().toISOString(),
          };

          setEvents((prev) => [...prev, pipelineEvent]);

          setStages((prev) => ({
            ...prev,
            [parsed.stage]: {
              stage: parsed.stage,
              status: parsed.status,
              payload: parsed.payload,
              durationMs: parsed.payload?.durationMs,
            },
          }));

          if (parsed.stage === 'preparing_final_results' && parsed.status === 'done') {
            isCompleteRef.current = true;
            setIsComplete(true);
            setConnectionStatus('completed');
            es.close();
          }
        }
      } catch {}
    };
  }, [searchId]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    stages,
    events,
    currentStage,
    error,
    isComplete,
    reconnect: connect,
  };
}
