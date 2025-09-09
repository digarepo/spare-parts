import { sign, verify, type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';

export type AccessPayload = {
  sub: string; // userId
  tenantId: string; // active tenant
  email: string;
};

export function signAccessToken(payload: AccessPayload): string {
  // use seconds to avoid overload ambiguity
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60 };
  return sign(payload, env.ACCESS_TOKEN_SECRET, options);
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = verify(token, env.ACCESS_TOKEN_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  const maybe = decoded as Partial<AccessPayload>;
  if (!maybe.sub || !maybe.tenantId || !maybe.email) {
    throw new Error('Invalid token payload');
  }
  return maybe as AccessPayload;
}
