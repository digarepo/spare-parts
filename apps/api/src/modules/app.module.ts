import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';

import { JwtGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AuthController } from '../routes/auth.controller';
import { DbHealthController } from '../routes/db-health.controller';
import { EnvHealthController } from '../routes/env-health.controller';
import { HealthController } from '../routes/health.controller';
import { MeController } from '../routes/me.controller';
import { TenantController } from '../routes/tenant.controller';
@Module({
  controllers: [
    HealthController,
    DbHealthController,
    EnvHealthController,
    MeController,
    TenantController,
    AuthController,
  ],
  providers: [
    Reflector,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
