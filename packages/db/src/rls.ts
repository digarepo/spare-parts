import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Add tables with tenant_id you want to protect via RLS.
// For now: memberships, user_roles, audit_logs (tenants itself often stays platform-managed).
const statements = [
  // Enable RLS
  sql`ALTER TABLE memberships ENABLE ROW LEVEL SECURITY`,
  sql`ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`,
  sql`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`,

  // Isolation policies (tenant match)
  sql`CREATE POLICY memberships_tenant_isolation ON memberships
      USING (tenant_id = current_setting('app.tenant_id')::uuid)`,

  sql`CREATE POLICY user_roles_tenant_isolation ON user_roles
      USING (tenant_id = current_setting('app.tenant_id')::uuid)`,

  sql`CREATE POLICY audit_tenant_isolation ON audit_logs
      USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid)`,
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  for (const s of statements) {
    await db.execute(s);
  }
  // eslint-disable-next-line no-console
  console.log('✅ RLS policies created. (Remember to set app.tenant_id per request)');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
