import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { PoolClient } from 'pg';

import { pool, drizzleFromClient, type AppDb } from '../db';

// Augment Express' Request to carry our context (types only)
declare module 'express-serve-static-core' {
  interface Request {
    db?: AppDb;
    pgClient?: PoolClient;
    tenantId?: string | undefined;
  }
}

@Injectable()
export class RequestDbMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const tenantIdHeader = req.header('x-tenant-id') ?? '';
    req.tenantId = tenantIdHeader || undefined;

    const client = await pool.connect();
    req.pgClient = client;

    try {
      await client.query('BEGIN');

      if (tenantIdHeader) {
        await client.query('SET LOCAL app.tenant_id = $1', [tenantIdHeader]);
      }

      req.db = drizzleFromClient(client);

      res.on('finish', () => {
        const finalize = async () => {
          try {
            if (res.statusCode >= 400) {
              await client.query('ROLLBACK');
            } else {
              await client.query('COMMIT');
            }
          } finally {
            client.release();
          }
        };
        void finalize();
      });

      next();
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        void rollbackErr;
      }
      client.release();
      next(err as Error);
    }
  }
}
