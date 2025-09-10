import * as fs from 'node:fs';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Load .env from repo root; fallback to CWD
const rootEnv = path.resolve(__dirname, '../../..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Enable RLS on tenant-scoped tables
  await db.execute(sql`ALTER TABLE memberships ENABLE ROW LEVEL SECURITY`);
  await db.execute(sql`ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`);
  await db.execute(sql`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`);

  // Idempotent: drop old policies if present
  await db.execute(sql`DROP POLICY IF EXISTS memberships_tenant_isolation ON memberships`);
  await db.execute(sql`DROP POLICY IF EXISTS user_roles_tenant_isolation ON user_roles`);
  await db.execute(sql`DROP POLICY IF EXISTS audit_tenant_isolation ON audit_logs`);

  // Safe policies: tolerate missing GUC; deny by default via impossible UUID
  await db.execute(sql`CREATE POLICY memberships_tenant_isolation ON memberships
    USING (
      tenant_id =
      COALESCE(NULLIF(current_setting('app.tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')::uuid
    )`);

  await db.execute(sql`CREATE POLICY user_roles_tenant_isolation ON user_roles
    USING (
      tenant_id =
      COALESCE(NULLIF(current_setting('app.tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')::uuid
    )`);

  await db.execute(sql`CREATE POLICY audit_tenant_isolation ON audit_logs
    USING (
      tenant_id IS NULL OR tenant_id =
      COALESCE(NULLIF(current_setting('app.tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')::uuid
    )`);

  console.log('✅ RLS policies applied (safe). Use withTenantDb() to set app.tenant_id.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
