import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from root or local
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  MODE: z
    .enum(['live', 'mock', 'test'])
    .default('live')
    .transform((val) => (val === 'test' ? 'mock' : val)),

  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URI' }),
  PG_BOSS_SCHEMA: z.string().default('pgboss'),

  UPLOAD_DIR: z.string().default('./uploads'),

  VISION_PROVIDER: z.enum(['gemini', 'mock']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),

  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  APIFY_API_TOKEN: z.string().optional(),

  MIN_MATCH_THRESHOLD: z.coerce.number().min(0).max(100).default(60),
  EMBEDDING_WEIGHT: z.coerce.number().min(0).max(1).default(0.4),
  RUBRIC_WEIGHT: z.coerce.number().min(0).max(1).default(0.6),
  DHASH_THRESHOLD: z.coerce.number().int().min(0).default(10),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    const errorMessage = `❌ Invalid environment variables:\n${formattedErrors}`;
    // Fails fast with readable error
    throw new Error(errorMessage);
  }
  return result.data;
}

// Cached config instance (lazy evaluated or exported)
let configInstance: Env | null = null;

export function getConfig(): Env {
  if (!configInstance) {
    configInstance = validateEnv();
  }
  return configInstance;
}

export function resetConfigForTest(newEnv?: Partial<NodeJS.ProcessEnv>): Env {
  if (newEnv) {
    configInstance = validateEnv({ ...process.env, ...newEnv });
  } else {
    configInstance = null;
  }
  return configInstance || validateEnv();
}
