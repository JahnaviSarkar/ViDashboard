import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../index';
import { searches } from '../schema';
import { randomUUID } from 'crypto';

export type SearchInsert = typeof searches.$inferInsert;
export type SearchSelect = typeof searches.$inferSelect;

export class SearchRepository {
  constructor(private db = getDb()) {}

  async create(data: Omit<SearchInsert, 'id' | 'createdAt'> & { id?: string }): Promise<SearchSelect> {
    const id = data.id || randomUUID();
    const [result] = await this.db
      .insert(searches)
      .values({
        ...data,
        id,
      })
      .returning();
    return result;
  }

  async getById(id: string): Promise<SearchSelect | null> {
    const [result] = await this.db.select().from(searches).where(eq(searches.id, id));
    return result || null;
  }

  async updateStatus(
    id: string,
    status: SearchSelect['status'],
    completedAt?: Date
  ): Promise<SearchSelect | null> {
    const [result] = await this.db
      .update(searches)
      .set({
        status,
        ...(completedAt !== undefined ? { completedAt } : {}),
      })
      .where(eq(searches.id, id))
      .returning();
    return result || null;
  }

  async getHistory(limit: number = 20, offset: number = 0): Promise<SearchSelect[]> {
    return this.db
      .select()
      .from(searches)
      .orderBy(desc(searches.createdAt))
      .limit(limit)
      .offset(offset);
  }
}
