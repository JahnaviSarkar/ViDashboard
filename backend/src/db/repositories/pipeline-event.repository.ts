import { eq, and, gt, asc } from 'drizzle-orm';
import { getDb } from '../index';
import { pipelineEvents } from '../schema';

export type PipelineEventInsert = typeof pipelineEvents.$inferInsert;
export type PipelineEventSelect = typeof pipelineEvents.$inferSelect;

export class PipelineEventRepository {
  constructor(private db = getDb()) {}

  async create(data: Omit<PipelineEventInsert, 'id' | 'createdAt'>): Promise<PipelineEventSelect> {
    const [result] = await this.db.insert(pipelineEvents).values(data).returning();
    return result;
  }

  async getEventsForReplay(searchId: string, sinceEventId?: number): Promise<PipelineEventSelect[]> {
    if (sinceEventId !== undefined && sinceEventId > 0) {
      return this.db
        .select()
        .from(pipelineEvents)
        .where(and(eq(pipelineEvents.searchId, searchId), gt(pipelineEvents.id, sinceEventId)))
        .orderBy(asc(pipelineEvents.id));
    }

    return this.db
      .select()
      .from(pipelineEvents)
      .where(eq(pipelineEvents.searchId, searchId))
      .orderBy(asc(pipelineEvents.id));
  }
}
