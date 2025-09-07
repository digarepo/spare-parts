import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Resolve repo root: packages/db -> packages -> <repo-root>
const REPO_ROOT = path.resolve(__dirname, '../../');

// Load the first existing env file from these candidates
const envCandidates = [path.join(REPO_ROOT, '.env'), path.join(REPO_ROOT, '.env.local')];

for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Add it to your repo root .env (or .env.local).');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/**/*.ts',
  out: '../../drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
