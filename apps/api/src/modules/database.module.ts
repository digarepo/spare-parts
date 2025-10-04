// apps/api/src/modules/database.module.ts
import { Global, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';

import { pool, schema, type AppDb } from '../db';

type AuthUser = { tenantId?: string; userId?: string; email?: string; permissions?: Set<string> };
type AuthedRequest = Request & { user?: AuthUser; res: Response };

@Global()
@Module({
  providers: [
    {
      provide: 'DB',
      scope: Scope.REQUEST,
      inject: [REQUEST],
      useFactory: async (req: AuthedRequest): Promise<AppDb> => {
        // Lease a dedicated client for this request
        const client: PoolClient = await pool.connect();

        // Release it when the response ends (no leaks)
        const releaseOnce = () => {
          try {
            client.release();
          } catch {
            /* noop */
          }
        };
        req.res.on('finish', releaseOnce);
        req.res.on('close', releaseOnce);
        req.res.on('error', releaseOnce);

        // Set tenant for RLS on this connection
        // Use `SET` (persists for this connection lifetime). If you wrap each request in a transaction,
        // you can switch to `SET LOCAL app.tenant_id = $1` safely.
        const tenantId = req.user?.tenantId;
        if (tenantId) {
          await client.query('SET app.tenant_id = $1', [tenantId]);
        }

        // Return a typed Drizzle DB bound to this client
        const db: AppDb = drizzle(client, { schema });
        return db;
      },
    },
  ],
  exports: ['DB'],
})
export class DatabaseModule {}
