import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  await app.listen(env.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`API ready on http://localhost:${env.API_PORT}`);
}
bootstrap();
