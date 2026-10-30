import { eq, gt, or, isNull } from 'drizzle-orm';
import { getDb } from '../index';
import { cacheEntries } from '../schema';

export type CacheEntryInsert = typeof cacheEntries.$inferInsert;
export type CacheEntrySelect = typeof cacheEntries.$inferSelect;

export class CacheRepository {
  constructor(private db = getDb()) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const now = new Date();
    const [result] = await this.db
      .select()
      .from(cacheEntries)
      .where(
        eq(cacheEntries.key, key)
      );

    if (!result) return null;

    if (result.expiresAt && result.expiresAt <= now) {
      // Expired entry - remove in background or return null
      await this.delete(key);
      return null;
    }

    return result.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
    await this.db
      .insert(cacheEntries)
      .values({
        key,
        value,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: {
          value,
          expiresAt,
        },
      });
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(cacheEntries).where(eq(cacheEntries.key, key));
  }
}
