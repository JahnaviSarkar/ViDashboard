import { getConfig } from '../../config/env';
import { VisionProvider } from './types';
import { GeminiVisionProvider } from './gemini.provider';
import { MockVisionProvider } from './mock.provider';
import { logger } from '../../utils/logger';

export * from './types';
export * from './mock.provider';
export * from './gemini.provider';

export function getVisionProvider(): VisionProvider {
  const config = getConfig();

  if (config.MODE === 'mock' || config.VISION_PROVIDER === 'mock') {
    logger.info('Using MockVisionProvider (mock mode configured)');
    return new MockVisionProvider();
  }

  if (config.VISION_PROVIDER === 'gemini') {
    if (!config.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not configured. Falling back to MockVisionProvider');
      return new MockVisionProvider();
    }
    return new GeminiVisionProvider(config.GEMINI_API_KEY);
  }

  return new MockVisionProvider();
}
