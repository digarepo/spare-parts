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
import type { ProductCreate, ProductUpdate } from 'packages/contracts/src/catalog';

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

  static async updateProduct(tenantId: string, productId: string, dto: ProductUpdate) {
    return withTenantDb(tenantId, async (rdb) => {
      // Ensure product belongs to tenant (RLS also enforces)
      const [existing] = await rdb
        .select({ id: products.id, status: products.status })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .limit(1);

      if (!existing) throw new Error('not_found');

      // Build a typed update object (no `any`, no Object.entries)
      const next: Partial<typeof products.$inferInsert> = {};

      if (dto.name !== undefined) next.name = dto.name;
      if (dto.slug !== undefined) next.slug = dto.slug;
      if (dto.sku !== undefined) next.sku = dto.sku;
      if (dto.status !== undefined) next.status = dto.status;
      if (dto.currency !== undefined) next.currency = dto.currency;
      if (dto.price !== undefined && dto.price !== null) next.price = String(dto.price);
      if (dto.compareAtPrice !== undefined) {
        next.compareAtPrice = dto.compareAtPrice == null ? null : String(dto.compareAtPrice);
      }
      if (dto.stockQty !== undefined) next.stockQty = dto.stockQty;
      if (dto.attributes !== undefined) next.attributes = dto.attributes;
      if (dto.shortDesc !== undefined) next.shortDesc = dto.shortDesc;
      if (dto.description !== undefined) next.description = dto.description;
      if (dto.categoryId !== undefined) next.categoryId = dto.categoryId ?? null;

      // Auto-publish timestamp when moving to active
      if (next.status === 'active' && existing.status !== 'active') {
        next.publishedAt = new Date();
      }

      // No-op update guard (optional)
      if (Object.keys(next).length === 0) {
        // nothing to update; return the current row shape consistently
        const [row] = await rdb
          .select()
          .from(products)
          .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
          .limit(1);
        return row!;
      }

      const [row] = await rdb
        .update(products)
        .set(next)
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .returning();

      return row!;
    });
  }

  static async deleteProduct(tenantId: string, productId: string) {
    return withTenantDb(tenantId, async (rdb) => {
      const [row] = await rdb
        .update(products)
        .set({ deletedAt: new Date(), status: 'archived' })
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .returning();

      if (!row) throw new Error('not_found');
      return { ok: true as const };
    });
  }
}
