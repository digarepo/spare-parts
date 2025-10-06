import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';

import { JwtGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CatalogController } from '../catalog/catalog.controller';
import { CategoryController } from '../catalog/category.controller';
import { AuthController } from '../routes/auth.controller';
import { DbHealthController } from '../routes/db-health.controller';
import { EnvHealthController } from '../routes/env-health.controller';
import { HealthController } from '../routes/health.controller';
import { MeController } from '../routes/me.controller';
import { PublicCatalogController } from '../routes/public-catalog.controller';
import { TenantController } from '../routes/tenant.controller';

import { CheckoutModule } from './checkout.module';
import { DatabaseModule } from './database.module';
import { InventoryModule } from './inventory.module';
@Module({
  imports: [InventoryModule, DatabaseModule, CheckoutModule],
  controllers: [
    HealthController,
    DbHealthController,
    EnvHealthController,
    MeController,
    TenantController,
    AuthController,
    CatalogController,
    CategoryController,
    PublicCatalogController,
  ],
  providers: [
    Reflector,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
