// apps/api/src/types/express.d.ts
import type { AccessPayload } from '../auth/jwt';
import type { AppDb } from '../db';

declare module 'express-serve-static-core' {
  interface Request {
    /** Request-scoped Drizzle DB (RLS-aware) */
    db?: AppDb;
    /** Raw JWT payload stored by JwtGuard */
    auth?: AccessPayload;
    /** Normalized identity for downstream usage */
    user?: {
      userId: string;
      tenantId: string;
      email: string;
      permissions?: Set<string>;
    };
  }
}
