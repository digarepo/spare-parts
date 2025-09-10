import 'dotenv/config';
import { users } from '@spare-parts/db/src/schema/iam';
import { tenants, roles, userRoles, memberships } from '@spare-parts/db/src/schema/rbac';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';

function arg(name: string, fallback?: string) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : fallback;
}

async function main() {
  const email = arg('email');
  const roleKey = arg('role', 'platform.readonly');
  const tenantName = arg('tenant', 'Spareparts Platform');

  if (!email)
    throw new Error(
      'Usage: --email=<email> [--role=platform.readonly] [--tenant="Spareparts Platform"]',
    );

  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) throw new Error('User not found');

  if (!tenantName) throw new Error('Tenant name is required');
  const [t] = await db.select().from(tenants).where(eq(tenants.name, tenantName)).limit(1);
  if (!t) throw new Error('Tenant not found');

  if (!roleKey) throw new Error('Role key is required');
  const [r] = await db.select().from(roles).where(eq(roles.key, roleKey)).limit(1);
  if (!r) throw new Error('Role not found');

  // Ensure membership
  await db
    .insert(memberships)
    .values({
      userId: u.id,
      tenantId: t.id,
      status: 'active',
      isPrimary: true,
    })
    .onConflictDoNothing();

  // Grant role
  await db
    .insert(userRoles)
    .values({
      userId: u.id,
      tenantId: t.id,
      roleId: r.id,
    })
    .onConflictDoNothing();

  // eslint-disable-next-line no-console
  console.log(`✅ Granted ${roleKey} to ${email} on tenant "${tenantName}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
