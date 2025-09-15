import { categories } from '@spare-parts/db/src/schema/catalog';
import { and, eq, ilike, isNull, desc, sql, type SQL } from 'drizzle-orm';
import type { CategoryCreate } from 'packages/contracts/src/catalog';

import { withTenantDb } from '../db';

type ListFilters = {
  q?: string;
  parentId?: string | null;
  page?: number;
  pageSize?: number;
};

export class CategoryService {
  static async list(tenantId: string, { q, parentId, page = 1, pageSize = 20 }: ListFilters) {
    return withTenantDb(tenantId, async (rdb) => {
      // Guaranteed non-empty tuple of conditions
      const conditions: [SQL, ...SQL[]] = [eq(categories.tenantId, tenantId)];
      if (q && q.trim()) conditions.push(ilike(categories.name, `%${q.trim()}%`));
      if (parentId === null) conditions.push(isNull(categories.parentId));
      else if (parentId) conditions.push(eq(categories.parentId, parentId));

      const where = and(...conditions);
      const offset = (page - 1) * pageSize;

      const items = await rdb
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          parentId: categories.parentId,
          createdAt: categories.createdAt,
        })
        .from(categories)
        .where(where)
        .orderBy(desc(categories.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Typed COUNT(*) → number
      const countRows = await rdb
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(categories)
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

  static async create(tenantId: string, dto: CategoryCreate) {
    return withTenantDb(tenantId, async (rdb) => {
      // Parent must be in-tenant if provided (RLS also enforces)
      if (dto.parentId) {
        const parent = await rdb.query.categories.findFirst({
          where: and(eq(categories.id, dto.parentId), eq(categories.tenantId, tenantId)),
          columns: { id: true },
        });
        if (!parent) throw new Error('invalid_parent');
      }

      const inserted = await rdb
        .insert(categories)
        .values({
          tenantId,
          parentId: dto.parentId ?? null,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
        })
        .returning();

      return inserted[0]!;
    });
  }
}
