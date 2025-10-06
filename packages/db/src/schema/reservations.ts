import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { products } from './catalog';
import { organizations } from './iam';

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    // Client-provided idempotency key (unique per tenant)
    key: text('key').notNull(),
    status: text('status').notNull().default('active'), // 'active' | 'released' | 'committed'
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
  },
  (t) => ({
    uqTenantKey: uniqueIndex('uq_reservations_tenant_key').on(t.tenantId, t.key),
    ixTenantStatus: index('ix_reservations_tenant_status').on(t.tenantId, t.status),
    ixTenantExpires: index('ix_reservations_tenant_expires').on(t.tenantId, t.expiresAt),
  }),
);

export const reservationItems = pgTable(
  'reservation_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qty: integer('qty').notNull(), // CHECK via SQL below (qty > 0)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqLine: uniqueIndex('uq_res_items_tenant_res_prod_seller').on(
      t.tenantId,
      t.reservationId,
      t.productId,
      t.sellerId,
    ),
    ixByProduct: index('ix_res_items_tenant_product_seller').on(
      t.tenantId,
      t.productId,
      t.sellerId,
    ),
  }),
);
