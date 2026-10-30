import { describe, it, expect } from 'vitest';
import { validateEnv, envSchema } from '../src/config/env';

describe('Environment Configuration Validation', () => {
  const baseValidEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/vidashboard',
    NODE_ENV: 'test',
    PORT: '3001',
    MODE: 'live',
    MIN_MATCH_THRESHOLD: '60',
  };

  it('successfully validates a complete and correct environment configuration', () => {
    const config = validateEnv({
      ...baseValidEnv,
      VISION_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-valid-key',
      EMBEDDING_WEIGHT: '0.4',
      RUBRIC_WEIGHT: '0.6',
    });

    expect(config.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/vidashboard');
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3001);
    expect(config.MODE).toBe('live');
    expect(config.GEMINI_MODEL).toBe('gemini-2.5-flash');
    expect(config.GEMINI_API_KEY).toBe('test-valid-key');
    expect(config.MIN_MATCH_THRESHOLD).toBe(60);
    expect(config.EMBEDDING_WEIGHT).toBe(0.4);
    expect(config.RUBRIC_WEIGHT).toBe(0.6);
  });

  it('fails fast when MODE=live, VISION_PROVIDER=gemini, and GEMINI_API_KEY is missing', () => {
    expect(() => {
      validateEnv({
        ...baseValidEnv,
        MODE: 'live',
        VISION_PROVIDER: 'gemini',
        GEMINI_API_KEY: '',
      });
    }).toThrow(/GEMINI_API_KEY is required when MODE=live/);
  });

  it('allows missing GEMINI_API_KEY when MODE=mock', () => {
    const config = validateEnv({
      ...baseValidEnv,
      MODE: 'mock',
      VISION_PROVIDER: 'mock',
      GEMINI_API_KEY: undefined,
    });
    expect(config.MODE).toBe('mock');
    expect(config.GEMINI_API_KEY).toBeUndefined();
  });

  it('fails fast and throws when DATABASE_URL is missing or invalid', () => {
    expect(() => {
      validateEnv({
        ...baseValidEnv,
        DATABASE_URL: 'not-a-valid-url',
      });
    }).toThrow(/DATABASE_URL must be a valid PostgreSQL connection URI/);

    expect(() => {
      validateEnv({
        NODE_ENV: 'test',
      } as any);
    }).toThrow(/DATABASE_URL/);
  });

  it('rejects invalid MODE values', () => {
    expect(() => {
      validateEnv({
        ...baseValidEnv,
        MODE: 'unsupported-mode' as any,
      });
    }).toThrow(/MODE/);
  });

  it('rejects out-of-range match threshold (> 100 or < 0)', () => {
    expect(() => {
      validateEnv({
        ...baseValidEnv,
        MIN_MATCH_THRESHOLD: '150',
      });
    }).toThrow(/MIN_MATCH_THRESHOLD/);

    expect(() => {
      validateEnv({
        ...baseValidEnv,
        MIN_MATCH_THRESHOLD: '-10',
      });
    }).toThrow(/MIN_MATCH_THRESHOLD/);
  });
});
