import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { products } from '../schema';
import { randomUUID } from 'crypto';

export type ProductInsert = typeof products.$inferInsert;
export type ProductSelect = typeof products.$inferSelect;

export class ProductRepository {
  constructor(private db = getDb()) {}

  async create(data: Omit<ProductInsert, 'id'> & { id?: string }): Promise<ProductSelect> {
    const id = data.id || randomUUID();
    const [result] = await this.db
      .insert(products)
      .values({
        ...data,
        id,
      })
      .returning();
    return result;
  }

  async getBySearchId(searchId: string): Promise<ProductSelect | null> {
    const [result] = await this.db.select().from(products).where(eq(products.searchId, searchId));
    return result || null;
  }

  async update(id: string, data: Partial<ProductInsert>): Promise<ProductSelect | null> {
    const [result] = await this.db.update(products).set(data).where(eq(products.id, id)).returning();
    return result || null;
  }
}
