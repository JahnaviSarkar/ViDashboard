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

  if (config.MODE === 'mock') {
    logger.info('Using MockVisionProvider (MODE=mock configured)');
    return new MockVisionProvider();
  }

  if (config.MODE === 'live') {
    if (config.VISION_PROVIDER === 'mock') {
      logger.info('Using MockVisionProvider (explicitly requested VISION_PROVIDER=mock)');
      return new MockVisionProvider();
    }

    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === '') {
      throw new Error(
        'FATAL: GEMINI_API_KEY is missing while MODE=live. Will not silently use mock provider. Set GEMINI_API_KEY or set MODE=mock.'
      );
    }

    return new GeminiVisionProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL);
  }

  throw new Error(`Unsupported configuration: MODE=${config.MODE}`);
}
