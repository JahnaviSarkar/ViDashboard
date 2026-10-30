import { eq, desc } from 'drizzle-orm';
import { getDb } from '../index';
import { searchResults, videos } from '../schema';
import { randomUUID } from 'crypto';

export type SearchResultInsert = typeof searchResults.$inferInsert;
export type SearchResultSelect = typeof searchResults.$inferSelect;

export class SearchResultRepository {
  constructor(private db = getDb()) {}

  async create(data: Omit<SearchResultInsert, 'id'> & { id?: string }): Promise<SearchResultSelect> {
    const id = data.id || randomUUID();
    const [result] = await this.db
      .insert(searchResults)
      .values({
        ...data,
        id,
      })
      .returning();
    return result;
  }

  async createMany(items: Array<Omit<SearchResultInsert, 'id'> & { id?: string }>): Promise<SearchResultSelect[]> {
    if (items.length === 0) return [];
    const valuesWithIds = items.map((item) => ({
      ...item,
      id: item.id || randomUUID(),
    }));
    return this.db.insert(searchResults).values(valuesWithIds).returning();
  }

  async getBySearchId(searchId: string): Promise<SearchResultSelect[]> {
    return this.db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId))
      .orderBy(desc(searchResults.matchScore));
  }

  async getWithVideos(searchId: string) {
    return this.db
      .select({
        result: searchResults,
        video: videos,
      })
      .from(searchResults)
      .innerJoin(videos, eq(searchResults.videoId, videos.id))
      .where(eq(searchResults.searchId, searchId))
      .orderBy(desc(searchResults.matchScore));
  }

  async truncate(): Promise<void> {
    await this.db.delete(searchResults);
  }
}
