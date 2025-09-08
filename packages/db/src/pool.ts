import fs from 'fs';
import path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

function ensureEnv() {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      break;
    }
  }
}

export function makePool(): Pool {
  ensureEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const u = new URL(url);
  return new Pool({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, ''),
    ssl: false,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });
}
