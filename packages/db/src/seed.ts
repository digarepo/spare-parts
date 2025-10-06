import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { makePool } from './pool';
import { roles, permissions, rolePermissions, tenants } from './schema/rbac';

async function main() {
  const pool = makePool();
  const db = drizzle(pool);

  // 1) Platform tenant
  await db
    .insert(tenants)
    .values({ name: 'Spareparts Platform', type: 'platform', status: 'active' })
    .onConflictDoNothing();

  // 2) Permissions
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
    'checkout.reserve',
    'checkout.release',
    'checkout.commit',
  ] as const;
  for (const key of permDefs) {
    await db.insert(permissions).values({ key }).onConflictDoNothing();
  }

  // 3) Roles (as data)
  const roleDefs = [
    { scope: 'platform', key: 'platform.owner', name: 'Platform Owner' },
    { scope: 'platform', key: 'platform.admin', name: 'Platform Admin' },
    { scope: 'platform', key: 'platform.ops', name: 'Platform Ops' },
    { scope: 'platform', key: 'platform.finance', name: 'Platform Finance' },
    { scope: 'platform', key: 'platform.support', name: 'Platform Support' },
    { scope: 'platform', key: 'platform.compliance', name: 'Platform Compliance' },
    { scope: 'platform', key: 'platform.bd', name: 'Business Development' },
    { scope: 'platform', key: 'platform.readonly', name: 'Platform Readonly' },
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

  for (const r of roleDefs) {
    await db
      .insert(roles)
      .values({
        scope: r.scope,
        key: r.key,
        name: r.name,
      })
      .onConflictDoNothing();
  }

  // 4) Role → Permission mapping
  const rolePermMap: Record<string, string[]> = {
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
      'checkout.reserve',
      'checkout.release',
      'checkout.commit',
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
      'checkout.reserve',
      'checkout.release',
      'checkout.commit',
    ],
    'org.catalog': [
      'catalog.sku.create',
      'catalog.sku.update',
      'catalog.sku.publish',
      'catalog.sku.read',
    ],
    'org.pricing': ['pricing.update', 'pricing.read'],
    'org.inventory': ['inventory.adjust', 'inventory.read'],
    'org.sales': [
      'orders.create',
      'orders.update',
      'orders.read',
      'checkout.reserve',
      'checkout.release',
      'checkout.commit',
    ],
    'org.fulfillment': [
      'orders.update',
      'orders.read',
      'checkout.reserve',
      'checkout.release',
      'checkout.commit',
    ],
    'org.accounting': ['orders.read', 'payout.read', 'report.financial.download'],
    'org.support': ['orders.read', 'catalog.sku.read'],
    'org.integrations': ['catalog.sku.read', 'inventory.read', 'orders.read'],
    'org.readonly': ['catalog.sku.read', 'inventory.read', 'pricing.read', 'orders.read'],
  };

  const perms = await db.select().from(permissions);
  const rolesRows = await db.select().from(roles);

  const permByKey = new Map(perms.map((p) => [p.key, p.id]));
  const roleByKey = new Map(rolesRows.map((r) => [r.key, r.id]));

  for (const [roleKey, permKeys] of Object.entries(rolePermMap)) {
    const rId = roleByKey.get(roleKey);
    if (!rId) continue;
    for (const pk of permKeys) {
      const pId = permByKey.get(pk);
      if (!pId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: rId, permissionId: pId })
        .onConflictDoNothing();
    }
  }

  await db.execute(sql`select now()`);
  console.log('✅ Seed complete (roles, permissions, role_permissions)');
  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
