import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE, PIPELINE_STAGES } from '../hooks/useSSE';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: any) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  emit(type: string, data: any, lastEventId?: string) {
    const event = { data: JSON.stringify(data), lastEventId: lastEventId || '1' };
    if (this.listeners[type]) {
      this.listeners[type].forEach((l) => l(event));
    }
  }

  close() {
    // closed
  }
}

describe('useSSE Hook', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    (global as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    delete (global as any).EventSource;
  });

  it('initializes all 10 pipeline stages as pending', () => {
    const { result } = renderHook(() => useSSE('test-search-id'));

    expect(Object.keys(result.current.stages)).toHaveLength(10);
    for (const item of PIPELINE_STAGES) {
      expect(result.current.stages[item.stage].status).toBe('pending');
    }
    expect(result.current.isComplete).toBe(false);
  });

  it('updates stage state and currentStage when running event is received', () => {
    const { result } = renderHook(() => useSSE('test-search-id'));
    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();

    act(() => {
      es.emit('resolving_product', {
        searchId: 'test-search-id',
        status: 'running',
        payload: { message: 'Resolving product' },
      });
    });

    expect(result.current.stages.resolving_product.status).toBe('running');
    expect(result.current.currentStage).toBe('resolving_product');
    expect(result.current.events).toHaveLength(1);
  });

  it('marks isComplete true and closes stream when preparing_final_results is done', () => {
    const { result } = renderHook(() => useSSE('test-search-id'));
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('preparing_final_results', {
        searchId: 'test-search-id',
        status: 'done',
        payload: { aboveThresholdCount: 5 },
      });
    });

    expect(result.current.stages.preparing_final_results.status).toBe('done');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.connectionStatus).toBe('completed');
  });
});
