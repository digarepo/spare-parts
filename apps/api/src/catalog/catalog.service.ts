// apps/api/src/catalog/catalog.service.ts
import { products, categories } from '@spare-parts/db/src/schema/catalog';
import { and, eq, ilike, isNull, desc, sql, type SQL } from 'drizzle-orm';
import type { ProductCreate } from 'packages/contracts/src/catalog';

import { withTenantDb } from '../db';

export type ListFilters = {
  q?: string;
  status?: 'draft' | 'active' | 'archived';
  categoryId?: string | null;
  page?: number;
  pageSize?: number;
};

export class CatalogService {
  static async listProducts(
    tenantId: string,
    { q, status, categoryId, page = 1, pageSize = 20 }: ListFilters,
  ) {
    return withTenantDb(tenantId, async (rdb) => {
      // Build a guaranteed non-empty list of conditions
      const conditions: [SQL, ...SQL[]] = [eq(products.tenantId, tenantId)];
      if (q && q.trim()) conditions.push(ilike(products.name, `%${q.trim()}%`));
      if (status) conditions.push(eq(products.status, status));
      if (categoryId === null) conditions.push(isNull(products.categoryId));
      else if (categoryId) conditions.push(eq(products.categoryId, categoryId));

      const where = and(...conditions);
      const offset = (page - 1) * pageSize;

      const items = await rdb
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          sku: products.sku,
          status: products.status,
          price: products.price,
          currency: products.currency,
          stockQty: products.stockQty,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(where)
        .orderBy(desc(products.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Typed COUNT(*) with safe read
      const countRows = await rdb
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(products)
        .where(where);
      const total = countRows[0]?.value ?? 0;

      return {
        items,
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      };
    });
  }

  static async createProduct(tenantId: string, dto: ProductCreate) {
    return withTenantDb(tenantId, async (rdb) => {
      // Ensure category (if passed) belongs to this tenant (RLS will also enforce)
      if (dto.categoryId) {
        const catRows = await rdb
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, dto.categoryId), eq(categories.tenantId, tenantId)))
          .limit(1);

        if (!catRows[0]) throw new Error('Invalid category for this tenant');
      }

      const inserted = await rdb
        .insert(products)
        .values({
          tenantId,
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          slug: dto.slug,
          sku: dto.sku,
          status: dto.status,
          currency: dto.currency ?? 'ETB',
          price: String(dto.price ?? 0),
          compareAtPrice: dto.compareAtPrice != null ? String(dto.compareAtPrice) : null,
          stockQty: dto.stockQty ?? 0,
          attributes: dto.attributes ?? {},
          shortDesc: dto.shortDesc ?? null,
          description: dto.description ?? null,
          publishedAt: dto.status === 'active' ? new Date() : null,
        })
        .returning();

      return inserted[0]!;
    });
  }
}
