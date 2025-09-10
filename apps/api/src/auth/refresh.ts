import crypto from 'node:crypto';

import { refreshTokens } from '@spare-parts/db/src/schema/auth';
import { and, eq, gt } from 'drizzle-orm';

import { env } from '../config/env';
import { db } from '../db';

export function generateOpaqueToken(): string {
  // 32 bytes → base64url (no padding)
  return crypto.randomBytes(32).toString('base64url');
}
export function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function issueRefreshToken(userId: string, tenantId: string) {
  const token = generateOpaqueToken();
  const tokenHash = sha256hex(token);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(refreshTokens)
    .values({ userId, tenantId, tokenHash, expiresAt })
    .onConflictDoNothing();
  return { refreshToken: token, expiresAt };
}

export async function rotateRefreshToken(oldToken: string) {
  const hash = sha256hex(oldToken);
  const now = new Date();
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hash),
        eq(refreshTokens.revoked, false),
        gt(refreshTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Revoke old
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, row.id));

  // Issue new
  const { refreshToken, expiresAt } = await issueRefreshToken(row.userId, row.tenantId);
  return { userId: row.userId, tenantId: row.tenantId, refreshToken, expiresAt };
}

export async function revokeRefreshToken(token: string) {
  const hash = sha256hex(token);
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.tokenHash, hash));
}
