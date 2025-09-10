import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { env } from './config/env';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  await app.listen(env.PORT);

  // eslint-disable-next-line no-console
  console.log(`API ready on http://localhost:${env.PORT}`);
}
void bootstrap();
