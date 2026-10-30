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
      EMBEDDING_WEIGHT: '0.4',
      RUBRIC_WEIGHT: '0.6',
    });

    expect(config.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/vidashboard');
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3001);
    expect(config.MODE).toBe('live');
    expect(config.MIN_MATCH_THRESHOLD).toBe(60);
    expect(config.EMBEDDING_WEIGHT).toBe(0.4);
    expect(config.RUBRIC_WEIGHT).toBe(0.6);
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
