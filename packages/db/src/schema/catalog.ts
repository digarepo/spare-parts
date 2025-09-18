import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

import { tenants } from './rbac';

// --- Enums ---
export const productStatusEnum = pgEnum('product_status', ['draft', 'active', 'archived']);

// ---------- Categories (tenant-scoped, hierarchical) ----------
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: false }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: false }),
  },
  (t) => ({
    uqTenantSlug: uniqueIndex('cat_tenant_slug_uq').on(t.tenantId, t.slug),
    byTenantParent: index('cat_tenant_parent_idx').on(t.tenantId, t.parentId),
    byTenantCreated: index('cat_tenant_created_idx').on(t.tenantId, t.createdAt),
  }),
);

// ---------- Products (tenant-scoped) ----------
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    sku: varchar('sku', { length: 64 }).notNull(),
    status: productStatusEnum('status').notNull().default('draft'),
    currency: varchar('currency', { length: 3 }).notNull().default('ETB'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
    compareAtPrice: numeric('compare_at_price', { precision: 12, scale: 2 }),
    stockQty: integer('stock_qty').notNull().default(0),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    shortDesc: varchar('short_desc', { length: 400 }),
    description: text('description'),
    publishedAt: timestamp('published_at', { withTimezone: false }),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: false }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: false }),
  },
  (t) => ({
    uqTenantSku: uniqueIndex('prod_tenant_sku_uq').on(t.tenantId, t.sku),
    uqTenantSlug: uniqueIndex('prod_tenant_slug_uq').on(t.tenantId, t.slug),
    byTenantCat: index('prod_tenant_category_idx').on(t.tenantId, t.categoryId),
    byTenantStatus: index('prod_tenant_status_idx').on(t.tenantId, t.status),
    byTenantCreated: index('prod_tenant_created_idx').on(t.tenantId, t.createdAt),
  }),
);

// ---------- Product Images ----------
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    alt: varchar('alt', { length: 200 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    byProduct: index('pimg_product_idx').on(t.productId),
    byPrimary: index('pimg_primary_idx').on(t.isPrimary),
    uqProductUrl: uniqueIndex('pimg_product_url_uq').on(t.productId, t.url),
  }),
);

// ---------- Vehicle dictionary (global; not tenant-scoped) ----------
export const vehicleMakes = pgTable(
  'vehicle_makes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
  },
  (t) => ({
    uqSlug: uniqueIndex('vmake_slug_uq').on(t.slug),
  }),
);

export const vehicleModels = pgTable(
  'vehicle_models',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    makeId: uuid('make_id')
      .notNull()
      .references(() => vehicleMakes.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 140 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
  },
  (t) => ({
    uqMakeSlug: uniqueIndex('vmodel_make_slug_uq').on(t.makeId, t.slug),
    byMake: index('vmodel_make_idx').on(t.makeId),
  }),
);

export const vehicleTrims = pgTable(
  'vehicle_trims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => vehicleModels.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(), // e.g., "1.6L Base"
    yearStart: integer('year_start').notNull(),
    yearEnd: integer('year_end').notNull(),
    engine: varchar('engine', { length: 120 }),
    fuel: varchar('fuel', { length: 30 }), // petrol/diesel/hybrid/EV
    transmission: varchar('transmission', { length: 60 }), // MT/AT/CVT/etc.
  },
  (t) => ({
    uqModelSpan: uniqueIndex('vtrim_model_span_name_uq').on(
      t.modelId,
      t.name,
      t.yearStart,
      t.yearEnd,
    ),
    byModel: index('vtrim_model_idx').on(t.modelId),
    bySpan: index('vtrim_span_idx').on(t.yearStart, t.yearEnd),
  }),
);

// ---------- Product ↔ Trim fitments (tenant-scoped link) ----------
export const productFitments = pgTable(
  'product_fitments',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    trimId: uuid('trim_id')
      .notNull()
      .references(() => vehicleTrims.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    uqProdTrim: uniqueIndex('pfit_product_trim_uq').on(t.productId, t.trimId),
    byTenant: index('pfit_tenant_idx').on(t.tenantId),
    byProduct: index('pfit_product_idx').on(t.productId),
    byTrim: index('pfit_trim_idx').on(t.trimId),
  }),
);
