import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { productAnalyses } from '../schema';
import { randomUUID } from 'crypto';

export type ProductAnalysisInsert = typeof productAnalyses.$inferInsert;
export type ProductAnalysisSelect = typeof productAnalyses.$inferSelect;

export class ProductAnalysisRepository {
  constructor(private db = getDb()) {}

  async getByImageHash(imageHash: string): Promise<ProductAnalysisSelect | null> {
    const [result] = await this.db
      .select()
      .from(productAnalyses)
      .where(eq(productAnalyses.imageHash, imageHash));
    return result || null;
  }

  async upsert(
    data: Omit<ProductAnalysisInsert, 'id' | 'createdAt'> & { id?: string }
  ): Promise<ProductAnalysisSelect> {
    const id = data.id || randomUUID();
    const [result] = await this.db
      .insert(productAnalyses)
      .values({
        ...data,
        id,
      })
      .onConflictDoUpdate({
        target: productAnalyses.imageHash,
        set: {
          attributes: data.attributes,
          queries: data.queries,
          hashtags: data.hashtags,
          provider: data.provider,
        },
      })
      .returning();
    return result;
  }
}
