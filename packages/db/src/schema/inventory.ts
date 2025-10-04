import { sql } from 'drizzle-orm';
import { pgTable, uuid, integer, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';

import { products } from './catalog';
import { organizations } from './iam';

export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(), // gen_random_uuid()
    tenantId: uuid('tenant_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qty: integer('qty').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_inventory_tenant_product_seller').on(t.tenantId, t.productId, t.sellerId),
    index('ix_inventory_tenant_product').on(t.tenantId, t.productId),
    index('ix_inventory_tenant_seller').on(t.tenantId, t.sellerId),
    check('chk_inventory_qty_nonneg', sql`${t.qty} >= 0`),
  ],
);
