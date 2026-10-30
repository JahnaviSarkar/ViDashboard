import { eq, and } from 'drizzle-orm';
import { getDb } from '../index';
import { videos } from '../schema';
import { randomUUID } from 'crypto';

export type VideoInsert = typeof videos.$inferInsert;
export type VideoSelect = typeof videos.$inferSelect;

export class VideoRepository {
  constructor(private db = getDb()) {}

  async getById(id: string): Promise<VideoSelect | null> {
    const [result] = await this.db.select().from(videos).where(eq(videos.id, id));
    return result || null;
  }

  async getByPlatformAndId(platform: string, platformVideoId: string): Promise<VideoSelect | null> {
    const [result] = await this.db
      .select()
      .from(videos)
      .where(and(eq(videos.platform, platform), eq(videos.platformVideoId, platformVideoId)));
    return result || null;
  }

  async upsert(data: Omit<VideoInsert, 'id' | 'firstSeenAt'> & { id?: string }): Promise<VideoSelect> {
    const id = data.id || randomUUID();
    const postedAt = data.postedAt ? new Date(data.postedAt) : undefined;
    const [result] = await this.db
      .insert(videos)
      .values({
        ...data,
        id,
        postedAt,
      })
      .onConflictDoUpdate({
        target: [videos.platform, videos.platformVideoId],
        set: {
          canonicalUrl: data.canonicalUrl,
          thumbnailUrl: data.thumbnailUrl,
          mediaUrl: data.mediaUrl,
          caption: data.caption,
          author: data.author,
          postedAt,
          mediaPhash: data.mediaPhash,
          embedding: data.embedding,
          raw: data.raw,
        },
      })
      .returning();
    return result;
  }
}
