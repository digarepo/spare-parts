import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { roles, permissions, rolePermissions, tenants } from './schema/rbac';

// Strongly typed Pool (now that @types/pg is available at root)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const PLATFORM_TENANT_NAME = 'Spareparts Platform';

const roleDefs = [
  // Platform
  { scope: 'platform', key: 'platform.owner', name: 'Platform Owner' },
  { scope: 'platform', key: 'platform.admin', name: 'Platform Admin' },
  { scope: 'platform', key: 'platform.ops', name: 'Platform Ops' },
  { scope: 'platform', key: 'platform.finance', name: 'Platform Finance' },
  { scope: 'platform', key: 'platform.support', name: 'Platform Support' },
  { scope: 'platform', key: 'platform.compliance', name: 'Platform Compliance' },
  { scope: 'platform', key: 'platform.bd', name: 'Business Development' },
  { scope: 'platform', key: 'platform.readonly', name: 'Platform Readonly' },
  // Org
  { scope: 'org', key: 'org.owner', name: 'Org Owner' },
  { scope: 'org', key: 'org.admin', name: 'Org Admin' },
  { scope: 'org', key: 'org.catalog', name: 'Catalog Manager' },
  { scope: 'org', key: 'org.pricing', name: 'Pricing Manager' },
  { scope: 'org', key: 'org.inventory', name: 'Inventory Manager' },
  { scope: 'org', key: 'org.sales', name: 'Sales' },
  { scope: 'org', key: 'org.fulfillment', name: 'Fulfillment' },
  { scope: 'org', key: 'org.accounting', name: 'Accounting' },
  { scope: 'org', key: 'org.support', name: 'Org Support' },
  { scope: 'org', key: 'org.integrations', name: 'Integrations' },
  { scope: 'org', key: 'org.readonly', name: 'Org Readonly' },
] as const;

const permDefs = [
  'tenant.create',
  'tenant.manage',
  'tenant.read',
  'user.invite',
  'user.manage',
  'user.read',
  'role.assign',
  'role.read',
  'catalog.sku.create',
  'catalog.sku.update',
  'catalog.sku.publish',
  'catalog.sku.read',
  'inventory.adjust',
  'inventory.read',
  'pricing.update',
  'pricing.read',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.read',
  'orders.refund.initiate',
  'orders.refund.approve',
  'payout.create',
  'payout.release',
  'payout.read',
  'report.financial.download',
  'report.operations.download',
] as const;

const rolePermMap: Record<string, readonly string[]> = {
  // Platform
  'platform.owner': [
    'tenant.create',
    'tenant.manage',
    'tenant.read',
    'user.manage',
    'user.read',
    'role.assign',
    'role.read',
    'report.financial.download',
    'report.operations.download',
    'payout.read',
    'payout.release',
  ],
  'platform.admin': [
    'tenant.manage',
    'tenant.read',
    'user.manage',
    'user.read',
    'role.assign',
    'role.read',
    'report.financial.download',
    'report.operations.download',
    'payout.read',
  ],
  'platform.ops': ['tenant.read', 'user.read', 'report.operations.download'],
  'platform.finance': [
    'tenant.read',
    'user.read',
    'report.financial.download',
    'payout.read',
    'payout.release',
  ],
  'platform.support': ['tenant.read', 'user.read'],
  'platform.compliance': ['tenant.read', 'user.read', 'report.operations.download'],
  'platform.bd': ['tenant.create', 'tenant.read'],
  'platform.readonly': ['tenant.read', 'user.read', 'role.read'],

  // Org
  'org.owner': [
    'user.manage',
    'user.read',
    'role.assign',
    'role.read',
    'catalog.sku.create',
    'catalog.sku.update',
    'catalog.sku.publish',
    'catalog.sku.read',
    'inventory.adjust',
    'inventory.read',
    'pricing.update',
    'pricing.read',
    'orders.create',
    'orders.update',
    'orders.cancel',
    'orders.read',
    'orders.refund.initiate',
    'orders.refund.approve',
    'payout.create',
    'payout.read',
  ],
  'org.admin': [
    'user.manage',
    'user.read',
    'role.assign',
    'role.read',
    'catalog.sku.create',
    'catalog.sku.update',
    'catalog.sku.publish',
    'catalog.sku.read',
    'inventory.adjust',
    'inventory.read',
    'pricing.update',
    'pricing.read',
    'orders.create',
    'orders.update',
    'orders.cancel',
    'orders.read',
    'orders.refund.initiate',
    'payout.read',
  ],
  'org.catalog': [
    'catalog.sku.create',
    'catalog.sku.update',
    'catalog.sku.publish',
    'catalog.sku.read',
  ],
  'org.pricing': ['pricing.update', 'pricing.read'],
  'org.inventory': ['inventory.adjust', 'inventory.read'],
  'org.sales': ['orders.create', 'orders.update', 'orders.read'],
  'org.fulfillment': ['orders.update', 'orders.read'],
  'org.accounting': ['orders.read', 'payout.read', 'report.financial.download'],
  'org.support': ['orders.read', 'catalog.sku.read'],
  'org.integrations': ['catalog.sku.read', 'inventory.read', 'orders.read'],
  'org.readonly': ['catalog.sku.read', 'inventory.read', 'pricing.read', 'orders.read'],
};

async function main(): Promise<void> {
  // 1) Platform tenant (idempotent)
  await db
    .insert(tenants)
    .values({ name: PLATFORM_TENANT_NAME, type: 'platform', status: 'active' })
    .onConflictDoNothing();

  // 2) Permissions (idempotent)
  for (const key of permDefs) {
    await db.insert(permissions).values({ key }).onConflictDoNothing();
  }

  // 3) Roles (idempotent)
  for (const rd of roleDefs) {
    await db
      .insert(roles)
      .values({ scope: rd.scope, key: rd.key, name: rd.name })
      .onConflictDoNothing();
  }

  // 4) Map role -> permissions
  const perms = await db.select().from(permissions);
  const roleRows = await db.select().from(roles);
  const permIdByKey = new Map(perms.map((p) => [p.key, p.id]));
  const roleIdByKey = new Map(roleRows.map((r) => [r.key, r.id]));

  for (const [roleKey, permKeys] of Object.entries(rolePermMap)) {
    const rId = roleIdByKey.get(roleKey);
    if (!rId) continue;
    for (const pk of permKeys) {
      const pId = permIdByKey.get(pk);
      if (!pId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: rId, permissionId: pId })
        .onConflictDoNothing();
    }
  }

  // smoke
  await db.execute(sql`SELECT now()`);
  // eslint-disable-next-line no-console
  console.log('✅ Seed complete: tenants/roles/permissions/role_permissions');
}

main()
  .then(() => pool.end())
  .catch((e: unknown) => {
    if (e instanceof Error) {
      // eslint-disable-next-line no-console
      console.error('Seed failed:', e.message);
      // eslint-disable-next-line no-console
      console.error(e.stack);
    } else {
      // eslint-disable-next-line no-console
      console.error('Seed failed:', String(e));
    }
    void pool.end();
    process.exit(1);
  });
