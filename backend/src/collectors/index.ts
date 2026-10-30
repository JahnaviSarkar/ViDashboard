export * from './types';
export * from './instagram.collector';
export * from './meta-ad-library.collector';
export * from './tiktok.collector';

import { Collector } from './types';
import { InstagramCollector } from './instagram.collector';
import { MetaAdLibraryCollector } from './meta-ad-library.collector';
import { TikTokCollector } from './tiktok.collector';

export function getActiveCollectors(mode?: 'live' | 'mock'): Collector[] {
  const currentMode = mode || (process.env.MODE === 'mock' ? 'mock' : 'live');
  return [
    new InstagramCollector({ mode: currentMode }),
    new MetaAdLibraryCollector({ mode: currentMode }),
    new TikTokCollector({ mode: currentMode }),
  ];
}
