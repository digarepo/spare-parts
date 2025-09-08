import { Module } from '@nestjs/common';

import { DbHealthController } from '../routes/db-health.controller';
import { HealthController } from '../routes/health.controller';

@Module({
  controllers: [HealthController, DbHealthController],
})
export class AppModule {}
