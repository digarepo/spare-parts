import { Module } from '@nestjs/common';

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
})
export class AppModule {}
