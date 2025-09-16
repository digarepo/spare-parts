import {
  products,
  categories,
  productImages,
  vehicleMakes,
  vehicleModels,
  vehicleTrims,
  productFitments,
} from '@spare-parts/db/src/schema/catalog';
import { and, eq, ilike, isNull, desc, sql, type SQL, inArray, gte, lte } from 'drizzle-orm';
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
      const [{ value: total } = { value: 0 }] = await rdb
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(products)
        .where(where);

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

  static async getProductBySlug(tenantId: string, slug: string) {
    return withTenantDb(tenantId, async (rdb) => {
      const [row] = await rdb
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          sku: products.sku,
          status: products.status,
          price: products.price,
          currency: products.currency,
          stockQty: products.stockQty,
          shortDesc: products.shortDesc,
          description: products.description,
          categoryId: products.categoryId,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.slug, slug)))
        .limit(1);

      if (!row) return null;

      const [img] = await rdb
        .select({ url: productImages.url, alt: productImages.alt })
        .from(productImages)
        .where(and(eq(productImages.productId, row.id), eq(productImages.isPrimary, true)))
        .limit(1);

      return { ...row, primaryImage: img ?? null };
    });
  }

  static async searchProductsByFitment(
    tenantId: string,
    params: {
      make: string; // make slug, e.g., "toyota"
      model: string; // model slug, e.g., "corolla"
      year: number; // e.g., 2016
      engine?: string | undefined; // optional, fuzzy contains
      page?: number;
      pageSize?: number;
    },
  ) {
    const { make, model, year, engine, page = 1, pageSize = 20 } = params;

    return withTenantDb(tenantId, async (rdb) => {
      const [mk] = await rdb
        .select({ id: vehicleMakes.id })
        .from(vehicleMakes)
        .where(eq(vehicleMakes.slug, make))
        .limit(1);
      if (!mk) return { items: [], page, pageSize, total: 0, pages: 1 };

      const [mdl] = await rdb
        .select({ id: vehicleModels.id })
        .from(vehicleModels)
        .where(and(eq(vehicleModels.slug, model), eq(vehicleModels.makeId, mk.id)))
        .limit(1);
      if (!mdl) return { items: [], page, pageSize, total: 0, pages: 1 };

      const trimConds: [SQL, ...SQL[]] = [
        eq(vehicleTrims.modelId, mdl.id),
        lte(vehicleTrims.yearStart, year),
        gte(vehicleTrims.yearEnd, year),
      ];
      if (engine && engine.trim()) {
        trimConds.push(ilike(vehicleTrims.engine, `%${engine.trim()}%`));
      }

      const trimWhere: (SQL | undefined)[] = [
        eq(vehicleTrims.modelId, mdl.id),
        lte(vehicleTrims.yearStart, year),
        gte(vehicleTrims.yearEnd, year),
        engine !== undefined ? ilike(vehicleTrims.engine, `%${engine}%`) : undefined,
      ];

      const trims = await rdb
        .select({ id: vehicleTrims.id })
        .from(vehicleTrims)
        .where(and(...(trimWhere.filter(Boolean) as SQL[])));

      if (trims.length === 0) return { items: [], page, pageSize, total: 0, pages: 1 };

      const trimIds = trims.map((t) => t.id);
      const offset = (page - 1) * pageSize;

      const rows = await rdb
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
        .from(productFitments)
        .innerJoin(products, eq(productFitments.productId, products.id))
        .where(
          and(
            eq(productFitments.tenantId, tenantId),
            inArray(productFitments.trimId, trimIds),
            eq(products.tenantId, tenantId),
            eq(products.status, 'active'),
          ),
        )
        .orderBy(desc(products.createdAt))
        .limit(pageSize)
        .offset(offset);

      const [{ value: total } = { value: 0 }] = await rdb
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(productFitments)
        .innerJoin(products, eq(productFitments.productId, products.id))
        .where(
          and(
            eq(productFitments.tenantId, tenantId),
            inArray(productFitments.trimId, trimIds),
            eq(products.tenantId, tenantId),
            eq(products.status, 'active'),
          ),
        );

      return {
        items: rows,
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      };
    });
  }
}
