import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

import { users } from './iam';

// --- Enums  ---
export const tenantTypeEnum = pgEnum('tenant_type', ['platform', 'org']);
export const tenantStatusEnum = pgEnum('tenant_status', ['pending', 'active', 'suspended']);
export const roleScopeEnum = pgEnum('role_scope', ['platform', 'org']);
export const memberStatusEnum = pgEnum('member_status', ['invited', 'active', 'disabled']);

// --- Tenants (includes the platform row) ---
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 140 }).notNull(),
    type: tenantTypeEnum('type').notNull().default('org'),
    status: tenantStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    byName: uniqueIndex('tenants_name_uq').on(t.name),
    byType: index('tenants_type_idx').on(t.type),
  }),
);

// --- Memberships (who belongs to which tenant) ---
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    status: memberStatusEnum('status').notNull().default('active'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    byUserTenant: uniqueIndex('member_user_tenant_uq').on(t.userId, t.tenantId),
    byUser: index('member_user_idx').on(t.userId),
    byTenant: index('member_tenant_idx').on(t.tenantId),
  }),
);

// --- Roles (as DATA; not DB enum) ---
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scope: roleScopeEnum('scope').notNull(), // 'platform' or 'org'
    key: varchar('key', { length: 120 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    byKey: uniqueIndex('roles_key_uq').on(t.key),
    byScope: index('roles_scope_idx').on(t.scope),
  }),
);

// --- Permissions catalog ---
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 160 }).notNull(),
    description: text('description'),
  },
  (t) => ({
    byKey: uniqueIndex('perm_key_uq').on(t.key),
  }),
);

// --- Join tables ---
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId], name: 'role_perm_pk' }),
  }),
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tenantId, t.roleId], name: 'user_role_pk' }),
    byUser: index('user_role_user_idx').on(t.userId),
    byTenant: index('user_role_tenant_idx').on(t.tenantId),
    byRole: index('user_role_role_idx').on(t.roleId),
  }),
);

// --- Audits (immutable log of sensitive actions) ---
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 160 }).notNull(),
    targetType: varchar('target_type', { length: 120 }),
    targetId: uuid('target_id'),
    data: jsonb('data'),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    byTenant: index('audit_tenant_idx').on(t.tenantId),
    byActor: index('audit_actor_idx').on(t.actorUserId),
    byAction: index('audit_action_idx').on(t.action),
  }),
);
