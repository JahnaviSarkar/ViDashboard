import { eq, and } from 'drizzle-orm';
import { getDb } from '../index';
import { sourceRuns } from '../schema';
import { randomUUID } from 'crypto';

export type SourceRunInsert = typeof sourceRuns.$inferInsert;
export type SourceRunSelect = typeof sourceRuns.$inferSelect;

export class SourceRunRepository {
  constructor(private db = getDb()) {}

  async create(data: Omit<SourceRunInsert, 'id' | 'startedAt'> & { id?: string }): Promise<SourceRunSelect> {
    const id = data.id || randomUUID();
    const [result] = await this.db
      .insert(sourceRuns)
      .values({
        ...data,
        id,
      })
      .returning();
    return result;
  }

  async update(
    id: string,
    updateData: Partial<Omit<SourceRunInsert, 'id' | 'searchId' | 'source'>>
  ): Promise<SourceRunSelect | null> {
    const [result] = await this.db
      .update(sourceRuns)
      .set(updateData)
      .where(eq(sourceRuns.id, id))
      .returning();
    return result || null;
  }

  async getBySearchId(searchId: string): Promise<SourceRunSelect[]> {
    return this.db.select().from(sourceRuns).where(eq(sourceRuns.searchId, searchId));
  }

  async getBySearchIdAndSource(searchId: string, source: string): Promise<SourceRunSelect | null> {
    const [result] = await this.db
      .select()
      .from(sourceRuns)
      .where(and(eq(sourceRuns.searchId, searchId), eq(sourceRuns.source, source)));
    return result || null;
  }
}
