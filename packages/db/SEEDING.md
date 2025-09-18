# Catalog Seeding

## What it does

- Creates base categories (Engine/Brakes/Suspension)
- Adds a Toyota → Corolla → 2014–2018 trim
- Inserts a demo product + primary image
- Links product to trim (fitment)

## RLS-aware

The script runs in a transaction and sets:
`SET LOCAL app.tenant_id = '<TENANT>'` so it passes RLS checks for tenant-scoped
tables.

## Run

```bash
# default: platform tenant
npm -w packages/db run seed:catalog

# choose a tenant
SEED_TENANT_NAME="Acme Motors" npm -w packages/db run seed:catalog
# or by id
SEED_TENANT_ID="uuid-here" npm -w packages/db run seed:catalog
```
