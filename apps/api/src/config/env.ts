import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';
import { z } from 'zod';

function loadEnvUpwards(startDir: string) {
  let dir = startDir;
  const names = ['.env.local', '.env']; // prefer .env.local if present
  // Walk up until filesystem root
  while (true) {
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        return p;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }
  return null;
}

const found = loadEnvUpwards(__dirname) || loadEnvUpwards(process.cwd()) || null;

if (!found) {
  // Not fatal yet; Zod validation below will give a helpful error
}

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(3000),
  PORT: z.coerce.number().int().positive().optional(),
});

export const env = (() => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(
      `Invalid environment: ${issues}. Make sure .env exists at the repo root (or any parent directory).`,
    );
  }
  const data = parsed.data;
  return {
    DATABASE_URL: data.DATABASE_URL,
    API_PORT: data.PORT ?? data.API_PORT,
  };
})();
