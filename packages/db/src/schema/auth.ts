import { pgTable, uuid, varchar, timestamp, boolean, index } from 'drizzle-orm/pg-core';

import { users } from './iam';
import { tenants } from './rbac';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: false }).notNull(),
    revoked: boolean('revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    byHash: index('rt_hash_idx').on(t.tokenHash),
    byUser: index('rt_user_idx').on(t.userId),
    byTenant: index('rt_tenant_idx').on(t.tenantId),
  }),
);
