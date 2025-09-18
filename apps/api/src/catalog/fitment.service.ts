import {
  products,
  productFitments,
  vehicleMakes,
  vehicleModels,
  vehicleTrims,
} from '@spare-parts/db/src/schema/catalog';
import type { SQL } from 'drizzle-orm';
import { and, eq, inArray, gte, lte, ilike, desc, sql } from 'drizzle-orm';

import { db } from '../db';

export class FitmentService {
  static async assertProductInTenant(tenantId: string, productId: string) {
    const row = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      columns: { id: true },
    });
    if (!row) throw new Error('product_not_in_tenant');
  }

  static async list(tenantId: string, productId: string, page = 1, pageSize = 50) {
    await this.assertProductInTenant(tenantId, productId);
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        trimId: vehicleTrims.id,
        modelId: vehicleTrims.modelId,
        name: vehicleTrims.name,
        yearStart: vehicleTrims.yearStart,
        yearEnd: vehicleTrims.yearEnd,
        engine: vehicleTrims.engine,
        fuel: vehicleTrims.fuel,
        transmission: vehicleTrims.transmission,
      })
      .from(productFitments)
      .innerJoin(vehicleTrims, eq(productFitments.trimId, vehicleTrims.id))
      .where(and(eq(productFitments.productId, productId), eq(productFitments.tenantId, tenantId)))
      .orderBy(desc(vehicleTrims.yearEnd))
      .limit(pageSize)
      .offset(offset);

    // (optional) total count
    const whereExpr = and(
      eq(productFitments.productId, productId),
      eq(productFitments.tenantId, tenantId),
    );

    const [{ value: total } = { value: 0 }] = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(productFitments)
      .where(whereExpr);

    // hydrate make/model slugs (small extra queries)
    // You can batch in one query if needed; keeping it simple for now.
    return { items: rows, page, pageSize, total: Number(total) };
  }

  static async addByTrimIds(tenantId: string, productId: string, trimIds: string[]) {
    await this.assertProductInTenant(tenantId, productId);
    if (trimIds.length === 0) return { added: 0 };

    // Validate trims exist
    const trims = await db
      .select({ id: vehicleTrims.id })
      .from(vehicleTrims)
      .where(inArray(vehicleTrims.id, trimIds));
    if (trims.length === 0) return { added: 0 };

    // Upsert mappings (idempotent via unique index)
    let added = 0;
    for (const t of trims) {
      const res = await db
        .insert(productFitments)
        .values({ productId, trimId: t.id, tenantId })
        .onConflictDoNothing()
        .returning();
      if (res.length) added++;
    }
    return { added };
  }

  static async addByCriteria(
    tenantId: string,
    productId: string,
    args: {
      make: string;
      model: string;
      yearStart: number;
      yearEnd: number;
      engine?: string | undefined;
    },
  ) {
    await this.assertProductInTenant(tenantId, productId);

    const [mk] = await db
      .select()
      .from(vehicleMakes)
      .where(eq(vehicleMakes.slug, args.make))
      .limit(1);
    if (!mk) throw new Error('make_not_found');

    const [mdl] = await db
      .select()
      .from(vehicleModels)
      .where(and(eq(vehicleModels.slug, args.model), eq(vehicleModels.makeId, mk.id)))
      .limit(1);
    if (!mdl) throw new Error('model_not_found');

    const rows = await db
      .select({ id: vehicleTrims.id })
      .from(vehicleTrims)
      .where(
        and(
          eq(vehicleTrims.modelId, mdl.id),
          lte(vehicleTrims.yearStart, args.yearEnd),
          gte(vehicleTrims.yearEnd, args.yearStart),
          args.engine
            ? ilike(vehicleTrims.engine, `%${args.engine}%`)
            : (undefined as unknown as SQL),
        ),
      );

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { added: 0, matched: 0 };

    const res = await this.addByTrimIds(tenantId, productId, ids);
    return { added: res.added, matched: ids.length };
  }

  static async remove(tenantId: string, productId: string, trimId: string) {
    await this.assertProductInTenant(tenantId, productId);
    const del = await db
      .delete(productFitments)
      .where(
        and(
          eq(productFitments.productId, productId),
          eq(productFitments.trimId, trimId),
          eq(productFitments.tenantId, tenantId),
        ),
      )
      .returning();
    return { removed: del.length > 0 };
  }
}
