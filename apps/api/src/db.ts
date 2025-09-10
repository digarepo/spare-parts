// apps/api/src/db.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

// Unified schema (so db.query.* works everywhere)
import * as auth from '@spare-parts/db/src/schema/auth';
import * as iam from '@spare-parts/db/src/schema/iam';
import * as rbac from '@spare-parts/db/src/schema/rbac';
import * as dotenv from 'dotenv';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';

// Load .env from repo root; fallback to CWD
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

export const schema = { ...iam, ...rbac, ...auth };
export type AppDb = NodePgDatabase<typeof schema>;

// Global pool & db (ok for non-tenant ops like /health, auth refresh lookups, etc.)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db: AppDb = drizzle(pool, { schema });

// Expose this for middleware or scripts that already rely on it
export function drizzleFromClient(client: PoolClient): AppDb {
  return drizzle(client, { schema });
}

// Request-scoped DB (RLS-safe). Prefer this inside guards/handlers.
export async function withTenantDb<T>(
  tenantId: string,
  fn: (rdb: AppDb, client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) throw new Error('withTenantDb: tenantId required');

  const client = await pool.connect();
  try {
    await client.query('begin');
    // Use set_config so the RLS policy sees app.tenant_id for this txn
    await client.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId]);

    const rdb = drizzleFromClient(client);
    const out = await fn(rdb, client);

    await client.query('commit');
    return out;
  } catch (e) {
    try {
      await client.query('rollback');
    } catch (rollback) {
      //rollback failed
    }
    throw e;
  } finally {
    client.release();
  }
}
