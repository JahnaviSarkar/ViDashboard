import { eq, sql } from 'drizzle-orm';
import { getDb } from '../index';
import { seenVideos } from '../schema';

export type SeenVideoInsert = typeof seenVideos.$inferInsert;
export type SeenVideoSelect = typeof seenVideos.$inferSelect;

export class SeenVideoRepository {
  constructor(private db = getDb()) {}

  async markSeen(videoId: string, searchId: string): Promise<SeenVideoSelect> {
    const [result] = await this.db
      .insert(seenVideos)
      .values({
        videoId,
        firstSearchId: searchId,
        timesReturned: 1,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: seenVideos.videoId,
        set: {
          timesReturned: sql`${seenVideos.timesReturned} + 1`,
          lastSeenAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async isSeen(videoId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ videoId: seenVideos.videoId })
      .from(seenVideos)
      .where(eq(seenVideos.videoId, videoId));
    return Boolean(result);
  }

  async getSeenMap(videoIds: string[]): Promise<Map<string, SeenVideoSelect>> {
    if (videoIds.length === 0) return new Map();
    const rows = await this.db.select().from(seenVideos);
    const map = new Map<string, SeenVideoSelect>();
    for (const row of rows) {
      if (videoIds.includes(row.videoId)) {
        map.set(row.videoId, row);
      }
    }
    return map;
  }

  async truncate(): Promise<void> {
    await this.db.delete(seenVideos);
  }
}
