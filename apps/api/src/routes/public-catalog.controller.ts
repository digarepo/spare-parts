import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { products, productImages } from '@spare-parts/db/src/schema/catalog';
import { and, desc, eq, ilike, isNull, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';

import { withTenantDb } from '../db';

/** ----- Zod DTOs ----- */

const ListQuerySchema = z.object({
  tenantId: z.string().uuid(),
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(), // use ?categoryId=null to filter uncategorized
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const BySlugQuerySchema = z.object({
  tenantId: z.string().uuid(),
});

/** ----- Response types ----- */

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: 'draft' | 'active' | 'archived';
  price: string; // pg numeric -> string
  currency: string;
  stockQty: number;
  createdAt: Date;
};

type ProductDetail = ProductListItem & {
  shortDesc: string | null;
  description: string | null;
  categoryId: string | null;
  primaryImage: { url: string; alt: string | null } | null;
};

@Controller('public/catalog')
export class PublicCatalogController {
  /** GET /public/catalog/products?tenantId=...&q=...&page=1&pageSize=20[&categoryId=...|null] */
  @Get('products')
  async list(@Query() raw: Record<string, unknown>): Promise<{
    ok: true;
    page: number;
    pageSize: number;
    total: number;
    pages: number;
    items: ProductListItem[];
  }> {
    const dto = ListQuerySchema.safeParse(raw);
    if (!dto.success) {
      throw new BadRequestException(dto.error.flatten().fieldErrors);
    }
    const { tenantId, q, categoryId, page, pageSize } = dto.data;

    return withTenantDb(tenantId, async (rdb) => {
      const where: SQL[] = [eq(products.tenantId, tenantId), eq(products.status, 'active')];

      if (q && q.trim()) {
        where.push(ilike(products.name, `%${q.trim()}%`));
      }

      // allow ?categoryId=null to filter uncategorized
      const categoryIdRaw = (raw['categoryId'] as string | undefined) ?? undefined;
      if (categoryIdRaw === 'null') {
        where.push(isNull(products.categoryId));
      } else if (categoryId) {
        where.push(eq(products.categoryId, categoryId));
      }

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
        .from(products)
        .where(and(...where))
        .orderBy(desc(products.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Ensure price is a string in the response (pg numeric comes back as string, but we map explicitly)
      const items: ProductListItem[] = rows.map((r) => ({
        ...r,
        price: String(r.price),
      }));

      const totalRow = await rdb
        .select({ value: count() })
        .from(products)
        .where(and(...where));

      const total = Number(totalRow[0]?.value ?? 0);
      const pages = Math.ceil(total / pageSize) || 1;

      return { ok: true, page, pageSize, total, pages, items };
    });
  }

  /** GET /public/catalog/products/:slug?tenantId=...  (active only) */
  @Get('products/:slug')
  async bySlug(
    @Param('slug') slug: string,
    @Query() raw: Record<string, unknown>,
  ): Promise<{ ok: true; product: ProductDetail } | { ok: false; error: 'not_found' }> {
    const dto = BySlugQuerySchema.safeParse(raw);
    if (!dto.success) {
      throw new BadRequestException(dto.error.flatten().fieldErrors);
    }
    const { tenantId } = dto.data;

    return withTenantDb(tenantId, async (rdb) => {
      const prod = await rdb
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
          shortDesc: products.shortDesc,
          description: products.description,
          categoryId: products.categoryId,
        })
        .from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            eq(products.slug, slug),
            eq(products.status, 'active'),
          ),
        )
        .limit(1);

      if (prod.length === 0) {
        return { ok: false, error: 'not_found' } as const;
      }
      const base = prod.at(0);
      if (!base) {
        return { ok: false, error: 'not_found' } as const;
      }

      const img = await rdb
        .select({ url: productImages.url, alt: productImages.alt })
        .from(productImages)
        .where(and(eq(productImages.productId, base.id), eq(productImages.isPrimary, true)))
        .limit(1);

      const primaryImage = img[0] ? { url: img[0].url, alt: img[0].alt ?? null } : null;

      const product: ProductDetail = {
        id: base.id,
        name: base.name,
        slug: base.slug,
        sku: base.sku,
        status: base.status,
        price: String(base.price),
        currency: base.currency,
        stockQty: base.stockQty,
        createdAt: base.createdAt,
        shortDesc: base.shortDesc ?? null,
        description: base.description ?? null,
        categoryId: base.categoryId ?? null,
        primaryImage,
      };

      return { ok: true, product };
    });
  }
}
