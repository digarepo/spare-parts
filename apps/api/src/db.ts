import 'dotenv/config';
import * as iam from '@spare-parts/db/src/schema/iam';
import * as rbac from '@spare-parts/db/src/schema/rbac';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';

export const schema = { ...rbac, ...iam };
export type AppDb = NodePgDatabase<typeof schema>;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Global db (OK for non-tenant ops like /health)
export const db: AppDb = drizzle(pool, { schema });

// Helper to create a request-scoped db from a single pg client
export function drizzleFromClient(client: PoolClient): AppDb {
  return drizzle(client, { schema });
}
