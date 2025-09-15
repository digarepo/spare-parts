import * as fs from 'node:fs';
import * as path from 'node:path';

import * as auth from '@spare-parts/db/src/schema/auth';
import * as catalog from '@spare-parts/db/src/schema/catalog';
import * as iam from '@spare-parts/db/src/schema/iam';
import * as rbac from '@spare-parts/db/src/schema/rbac';
import * as dotenv from 'dotenv';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';

// --- Load .env from repo root (fallback to CWD) ---
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

// --- Unified schema (so db.query.* is fully typed everywhere) ---

export const schema = { ...iam, ...rbac, ...auth, ...catalog };
export type AppDb = NodePgDatabase<typeof schema>;

// --- Global pool & db (OK for non-tenant ops like /health) ---
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db: AppDb = drizzle(pool, { schema });

// Helper to bind drizzle to an existing pg client
export function drizzleFromClient(client: PoolClient): AppDb {
  return drizzle(client, { schema });
}

/**
 * Request-scoped DB (RLS-safe): starts a tx, sets app.tenant_id,
 * provides a typed drizzle instance bound to that transaction.
 */
export async function withTenantDb<T>(
  tenantId: string,
  fn: (rdb: AppDb, client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) throw new Error('withTenantDb: tenantId required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Make app.tenant_id visible to RLS policies for this transaction
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);

    const rdb = drizzleFromClient(client);
    const out = await fn(rdb, client);

    await client.query('COMMIT');
    return out;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw e;
  } finally {
    client.release();
  }
}
