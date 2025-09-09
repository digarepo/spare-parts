import { users } from '@spare-parts/db/src/schema/iam';
import { memberships, tenants } from '@spare-parts/db/src/schema/rbac';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';

import { hashPassword, verifyPassword } from './crypto';
import { signAccessToken } from './jwt';

export class AuthService {
  static async register(
    email: string,
    fullName: string | undefined,
    password: string,
    tenantId?: string,
  ): Promise<{
    access_token: string;
    user: {
      id: string;
      email: string;
      fullName: string | null;
      passwordHash: string | null;
      createdAt: Date;
    };
    tenantId: string;
  }> {
    const [tenant] = tenantId
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
      : await db.select().from(tenants).where(eq(tenants.type, 'platform')).limit(1);

    if (!tenant) throw new Error('Tenant not found');

    const passHash = await hashPassword(password);

    const [inserted] = await db
      .insert(users)
      .values({ email, fullName, passwordHash: passHash })
      .onConflictDoNothing()
      .returning();

    const user =
      inserted ?? (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];

    if (!user) throw new Error('User upsert failed');

    await db
      .insert(memberships)
      .values({
        userId: user.id,
        tenantId: tenant.id,
        status: 'active',
        isPrimary: true,
      })
      .onConflictDoNothing();

    const token = signAccessToken({ sub: user.id, tenantId: tenant.id, email: user.email });
    return { access_token: token, user, tenantId: tenant.id };
  }

  static async login(
    email: string,
    password: string,
    tenantId?: string,
  ): Promise<{
    access_token: string;
    user: {
      id: string;
      email: string;
      fullName: string | null;
      passwordHash: string | null;
      createdAt: Date;
    };
    tenantId: string;
  }> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.passwordHash) throw new Error('Invalid credentials');

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) throw new Error('Invalid credentials');

    let activeTenantId = tenantId;
    if (activeTenantId) {
      const m = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, user.id),
          eq(memberships.tenantId, activeTenantId),
          eq(memberships.status, 'active'),
        ),
        columns: { id: true },
      });
      if (!m) throw new Error('No membership for that tenant');
    } else {
      const m = await db.query.memberships.findFirst({
        where: and(eq(memberships.userId, user.id), eq(memberships.isPrimary, true)),
        columns: { tenantId: true },
      });
      if (!m?.tenantId) throw new Error('No active tenant membership');
      activeTenantId = m.tenantId;
    }

    const token = signAccessToken({ sub: user.id, tenantId: activeTenantId, email: user.email });
    return { access_token: token, user, tenantId: activeTenantId };
  }
}
