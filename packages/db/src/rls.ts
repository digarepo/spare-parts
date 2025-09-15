import * as fs from 'node:fs';
import * as path from 'node:path';

import * as dotenv from 'dotenv';
import { type SQL, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Load .env from repo root; fallback to CWD
const rootEnv = path.resolve(__dirname, '../../..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const statements: SQL[] = [];
  const TENANT_GUC = sql`COALESCE(NULLIF(current_setting('app.tenant_id', true),'')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`;

  // ===== Core IAM tables =====
  statements.push(sql`ALTER TABLE memberships ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS memberships_tenant_isolation ON memberships`);
  statements.push(sql`CREATE POLICY memberships_tenant_isolation ON memberships
    USING (tenant_id = ${TENANT_GUC})`);

  statements.push(sql`ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS user_roles_tenant_isolation ON user_roles`);
  statements.push(sql`CREATE POLICY user_roles_tenant_isolation ON user_roles
    USING (tenant_id = ${TENANT_GUC})`);

  statements.push(sql`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS audit_tenant_isolation ON audit_logs`);
  statements.push(sql`CREATE POLICY audit_tenant_isolation ON audit_logs
    USING (tenant_id IS NULL OR tenant_id = ${TENANT_GUC})`);

  // ===== Catalog: categories =====
  statements.push(sql`ALTER TABLE categories ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS categories_isolation ON categories`);
  statements.push(sql`DROP POLICY IF EXISTS categories_write_tenant ON categories`);
  statements.push(sql`CREATE POLICY categories_isolation ON categories
    USING (tenant_id = ${TENANT_GUC})`);
  statements.push(sql`CREATE POLICY categories_write_tenant ON categories
    FOR ALL TO PUBLIC
    USING (tenant_id = ${TENANT_GUC})
    WITH CHECK (tenant_id = ${TENANT_GUC})`);

  // ===== Catalog: products =====
  statements.push(sql`ALTER TABLE products ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS products_isolation ON products`);
  statements.push(sql`DROP POLICY IF EXISTS products_write_tenant ON products`);
  statements.push(sql`CREATE POLICY products_isolation ON products
    USING (tenant_id = ${TENANT_GUC})`);
  statements.push(sql`CREATE POLICY products_write_tenant ON products
    FOR ALL TO PUBLIC
    USING (tenant_id = ${TENANT_GUC})
    WITH CHECK (tenant_id = ${TENANT_GUC})`);

  // ===== Catalog: product_images (derive tenant via product) =====
  statements.push(sql`ALTER TABLE product_images ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS product_images_isolation ON product_images`);
  statements.push(sql`DROP POLICY IF EXISTS product_images_write_tenant ON product_images`);
  statements.push(sql`CREATE POLICY product_images_isolation ON product_images
    USING (EXISTS (SELECT 1 FROM products p
                   WHERE p.id = product_images.product_id
                     AND p.tenant_id = ${TENANT_GUC}))`);
  statements.push(sql`CREATE POLICY product_images_write_tenant ON product_images
    FOR ALL TO PUBLIC
    USING (EXISTS (SELECT 1 FROM products p
                   WHERE p.id = product_images.product_id
                     AND p.tenant_id = ${TENANT_GUC}))
    WITH CHECK (EXISTS (SELECT 1 FROM products p
                        WHERE p.id = product_images.product_id
                          AND p.tenant_id = ${TENANT_GUC}))`);

  // ===== Catalog: product_fitments =====
  statements.push(sql`ALTER TABLE product_fitments ENABLE ROW LEVEL SECURITY`);
  statements.push(sql`DROP POLICY IF EXISTS product_fitments_isolation ON product_fitments`);
  statements.push(sql`DROP POLICY IF EXISTS product_fitments_write_tenant ON product_fitments`);
  statements.push(sql`CREATE POLICY product_fitments_isolation ON product_fitments
    USING (tenant_id = ${TENANT_GUC})`);
  statements.push(sql`CREATE POLICY product_fitments_write_tenant ON product_fitments
    FOR ALL TO PUBLIC
    USING (tenant_id = ${TENANT_GUC})
    WITH CHECK (tenant_id = ${TENANT_GUC})`);

  // Execute in order
  for (const s of statements) {
    await db.execute(s);
  }

  console.log('✅ RLS policies applied (safe). Use withTenantDb() to set app.tenant_id.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
