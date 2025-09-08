import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { makePool } from './pool';
import { users } from './schema/iam';
import { tenants, roles, userRoles, memberships } from './schema/rbac';

async function main() {
  const pool = makePool();
  const db = drizzle(pool);

  const demoEmail = process.env.DEMO_EMAIL ?? 'owner@local.test';

  // Platform tenant
  const existingPlatform = await db
    .select()
    .from(tenants)
    .where(eq(tenants.type, 'platform'))
    .limit(1);
  const platform = existingPlatform[0];
  if (!platform) throw new Error('Platform tenant not found. Run base seed first.');

  // Upsert user
  const insertedUsers = await db
    .insert(users)
    .values({ email: demoEmail, fullName: 'Demo Owner' })
    .onConflictDoNothing()
    .returning();
  const userRow =
    insertedUsers[0] ??
    (await db.select().from(users).where(eq(users.email, demoEmail)).limit(1))[0];
  if (!userRow) throw new Error('Failed to upsert demo user');

  // Ensure membership
  await db
    .insert(memberships)
    .values({
      userId: userRow.id,
      tenantId: platform.id,
      status: 'active',
      isPrimary: true,
    })
    .onConflictDoNothing();

  // Assign role platform.owner
  const roleRow = (
    await db.select().from(roles).where(eq(roles.key, 'platform.owner')).limit(1)
  )[0];
  if (!roleRow) throw new Error('platform.owner role missing (seed roles first)');
  await db
    .insert(userRoles)
    .values({
      userId: userRow.id,
      tenantId: platform.id,
      roleId: roleRow.id,
    })
    .onConflictDoNothing();

  console.log('✅ Demo seeded:');
  console.log('  userId   =', userRow.id);
  console.log('  tenantId =', platform.id);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
