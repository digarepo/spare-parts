import './load-env';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import {
  categories,
  products,
  productImages,
  vehicleMakes,
  vehicleModels,
  vehicleTrims,
  productFitments,
} from './schema/catalog';
import { tenants } from './schema/rbac';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function pickTenant() {
  const byId = process.env.SEED_TENANT_ID;
  const byName = process.env.SEED_TENANT_NAME;
  if (byId) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, byId)).limit(1);
    if (!t) throw new Error(`Tenant not found by id: ${byId}`);
    return t;
  }
  if (byName) {
    // unique name enforced in schema
    const [t] = await db.select().from(tenants).where(eq(tenants.name, byName)).limit(1);
    if (!t) throw new Error(`Tenant not found by name: ${byName}`);
    return t;
  }
  const [platform] = await db.select().from(tenants).where(eq(tenants.type, 'platform')).limit(1);
  if (!platform) throw new Error('Platform tenant not found (run base seeds first)');
  return platform;
}

async function main() {
  const tenant = await pickTenant();

  // ---- RLS-safe transaction: set tenant for all checks in this tx ----
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = ${tenant.id}`);

    // Categories (idempotent)
    const catData = [
      { name: 'Engine', slug: 'engine' },
      { name: 'Brakes', slug: 'brakes' },
      { name: 'Suspension', slug: 'suspension' },
    ];
    for (const c of catData) {
      await tx
        .insert(categories)
        .values({ tenantId: tenant.id, name: c.name, slug: c.slug })
        .onConflictDoNothing();
    }

    // Vehicle dictionary (global, no RLS)
    const insertedMake = await tx
      .insert(vehicleMakes)
      .values({ name: 'Toyota', slug: 'toyota' })
      .onConflictDoNothing()
      .returning();
    const vMake =
      insertedMake[0] ??
      (await tx.select().from(vehicleMakes).where(eq(vehicleMakes.slug, 'toyota')).limit(1))[0];
    if (!vMake) throw new Error('Seed failure: vehicle make (toyota) missing');

    const insertedModel = await tx
      .insert(vehicleModels)
      .values({ makeId: vMake.id, name: 'Corolla', slug: 'corolla' })
      .onConflictDoNothing()
      .returning();
    const vModel =
      insertedModel[0] ??
      (await tx.select().from(vehicleModels).where(eq(vehicleModels.slug, 'corolla')).limit(1))[0];
    if (!vModel) throw new Error('Seed failure: vehicle model (corolla) missing');

    const insertedTrim = await tx
      .insert(vehicleTrims)
      .values({
        modelId: vModel.id,
        name: '1.6L Base',
        yearStart: 2014,
        yearEnd: 2018,
        engine: '1.6L',
        fuel: 'petrol',
        transmission: 'AT',
      })
      .onConflictDoNothing()
      .returning();
    const vTrim =
      insertedTrim[0] ??
      (await tx.select().from(vehicleTrims).where(eq(vehicleTrims.modelId, vModel.id)).limit(1))[0];
    if (!vTrim) throw new Error('Seed failure: vehicle trim (Corolla 1.6L) missing');

    // Product (idempotent)
    const engineCat = (
      await tx.select().from(categories).where(eq(categories.slug, 'engine')).limit(1)
    )[0];

    const insertedProduct = await tx
      .insert(products)
      .values({
        tenantId: tenant.id,
        categoryId: engineCat?.id ?? null,
        name: 'Oil Filter Corolla 2014–2018',
        slug: 'oil-filter-corolla-2014-2018',
        sku: 'OF-COR-2014-2018',
        status: 'active',
        currency: 'ETB',
        price: '850.00',
        stockQty: 25,
        attributes: { brand: 'OEM', compatibleEngines: ['1.6L'], warranty_months: 6 },
        shortDesc: 'Oil filter suitable for Corolla 2014–2018 1.6L.',
      })
      .onConflictDoNothing()
      .returning();

    const product =
      insertedProduct[0] ??
      (
        await tx
          .select()
          .from(products)
          .where(eq(products.slug, 'oil-filter-corolla-2014-2018'))
          .limit(1)
      )[0];
    if (!product?.id) throw new Error('Seed failure: product missing');

    // Product image (idempotent via UNIQUE(product_id,url))
    await tx
      .insert(productImages)
      .values({
        productId: product.id,
        url: 'https://example.com/images/oil-filter.jpg',
        alt: 'Oil Filter',
        isPrimary: true,
        sortOrder: 1,
      })
      .onConflictDoNothing();

    // Fitment link (already has UNIQUE(product_id, trim_id))
    await tx
      .insert(productFitments)
      .values({ productId: product.id, trimId: vTrim.id, tenantId: tenant.id })
      .onConflictDoNothing();
  });

  // eslint-disable-next-line no-console
  console.log('✅ Catalog seed complete for tenant:', tenant.name);
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
