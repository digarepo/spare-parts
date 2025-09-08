import { makePool } from '@spare-parts/db/src/pool';
import * as DBSchema from '@spare-parts/db/src/schema';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = makePool();
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const db = drizzle<typeof DBSchema>(pool, { schema: DBSchema });
export const pg = pool;
