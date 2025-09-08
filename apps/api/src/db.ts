import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Pool as PoolType, PoolConfig } from 'pg';

import { env } from './config/env';

const pgConfig: PoolConfig = { connectionString: env.DATABASE_URL };
const pool: PoolType = new Pool(pgConfig);

export const pg: PoolType = pool;
export const db: NodePgDatabase = drizzle(pool, { logger: false });
