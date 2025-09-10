import { resolve } from 'node:path';

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
dotenvConfig({ path: resolve(process.cwd(), '../../.env') });
dotenvConfig();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  ACCESS_TOKEN_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = (() => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = JSON.stringify(parsed.error.format(), null, 2);
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment variables:', msg);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
})();
