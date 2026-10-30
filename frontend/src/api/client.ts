import { SearchDetails, SearchItemSummary } from '../types';

export interface CreateSearchParams {
  inputType: 'product_url' | 'keyword' | 'image_upload';
  url?: string;
  query?: string;
  image?: File;
  sources: Array<'instagram' | 'meta'>;
  minMatchThreshold?: number;
  mode?: 'live' | 'mock';
}

export interface CreateSearchResponse {
  searchId: string;
  status: string;
  inputType: string;
}

export async function createSearch(params: CreateSearchParams): Promise<CreateSearchResponse> {
  if (params.inputType === 'image_upload' && params.image) {
    const formData = new FormData();
    formData.append('image', params.image);
    formData.append('sources', JSON.stringify(params.sources));
    if (params.minMatchThreshold !== undefined) {
      formData.append('minMatchThreshold', String(params.minMatchThreshold));
    }
    if (params.mode) {
      formData.append('mode', params.mode);
    }

    const res = await fetch('/api/search', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error?.message || `Search creation failed: ${res.statusText}`);
    }
    return res.json();
  }

  const payload: Record<string, any> = {
    sources: params.sources,
    minMatchThreshold: params.minMatchThreshold ?? 60,
  };
  if (params.mode) {
    payload.mode = params.mode;
  }

  if (params.inputType === 'product_url') {
    payload.url = params.url;
    payload.productUrl = params.url;
  } else if (params.inputType === 'keyword') {
    payload.query = params.query;
  }

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || `Search creation failed: ${res.statusText}`);
  }

  return res.json();
}

export async function getSearchDetails(id: string): Promise<SearchDetails> {
  const res = await fetch(`/api/search/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || `Failed to fetch search: ${res.statusText}`);
  }
  return res.json();
}

export async function getRecentSearches(limit = 10): Promise<SearchItemSummary[]> {
  try {
    const res = await fetch(`/api/history?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.searches || [];
  } catch {
    return [];
  }
}

export async function retrySearch(id: string): Promise<CreateSearchResponse> {
  const res = await fetch(`/api/search/${id}/retry`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Retry failed: ${res.statusText}`);
  }
  return res.json();
}

