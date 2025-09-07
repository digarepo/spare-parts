import { Module } from '@nestjs/common';
import { HealthController } from '../routes/health.controller';
import { DbHealthController } from '../routes/db-health.controller';

@Module({
  controllers: [HealthController, DbHealthController],
})
export class AppModule {}
