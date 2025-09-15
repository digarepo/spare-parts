import './load-env';
import { eq } from 'drizzle-orm';
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

async function main() {
  // Use platform tenant for demo seed
  const [tenant] = await db.select().from(tenants).where(eq(tenants.type, 'platform')).limit(1);
  if (!tenant) throw new Error('Platform tenant not found (run base seeds first)');

  // Categories
  const catData = [
    { name: 'Engine', slug: 'engine' },
    { name: 'Brakes', slug: 'brakes' },
    { name: 'Suspension', slug: 'suspension' },
  ];
  for (const c of catData) {
    await db
      .insert(categories)
      .values({
        tenantId: tenant.id,
        name: c.name,
        slug: c.slug,
      })
      .onConflictDoNothing();
  }

  // Vehicle dictionary: Toyota → Corolla → 2014–2018 (1.6L)
  const insertedMake = await db
    .insert(vehicleMakes)
    .values({ name: 'Toyota', slug: 'toyota' })
    .onConflictDoNothing()
    .returning();

  const vMake =
    insertedMake[0] ??
    (await db.select().from(vehicleMakes).where(eq(vehicleMakes.slug, 'toyota')).limit(1))[0];
  if (!vMake) throw new Error('Seed failure: vehicle make (toyota) missing');

  const insertedModel = await db
    .insert(vehicleModels)
    .values({ makeId: vMake.id, name: 'Corolla', slug: 'corolla' })
    .onConflictDoNothing()
    .returning();

  const vModel =
    insertedModel[0] ??
    (await db.select().from(vehicleModels).where(eq(vehicleModels.slug, 'corolla')).limit(1))[0];
  if (!vModel) throw new Error('Seed failure: vehicle model (corolla) missing');

  const insertedTrim = await db
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
    (await db.select().from(vehicleTrims).where(eq(vehicleTrims.modelId, vModel.id)).limit(1))[0];
  if (!vTrim) throw new Error('Seed failure: vehicle trim (Corolla 1.6L) missing');

  // A demo product
  const engineCat = (
    await db.select().from(categories).where(eq(categories.slug, 'engine')).limit(1)
  )[0];

  const insertedProduct = await db
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
      await db
        .select()
        .from(products)
        .where(eq(products.slug, 'oil-filter-corolla-2014-2018'))
        .limit(1)
    )[0];
  if (!product) throw new Error('Seed failure: product missing');

  const productId = product.id;
  if (!productId) throw new Error('Seed failure: product ID missing');

  const trimId = vTrim.id;
  if (!trimId) throw new Error('Seed failure: vehicle trim ID missing');

  const tenantId = tenant.id;
  if (!tenantId) throw new Error('Seed failure: tenant ID missing');

  // image
  await db
    .insert(productImages)
    .values({
      productId,
      url: 'https://example.com/images/oil-filter.jpg',
      alt: 'Oil Filter',
      isPrimary: true,
      sortOrder: 1,
    })
    .onConflictDoNothing();

  // fitment map
  await db
    .insert(productFitments)
    .values({
      productId,
      trimId: vTrim.id,
      tenantId: tenant.id,
    })
    .onConflictDoNothing();

  // eslint-disable-next-line no-console
  console.log('✅ Catalog seed complete.');
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
