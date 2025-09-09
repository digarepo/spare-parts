import { Controller, Get } from '@nestjs/common';

import { env } from '../config/env';

@Controller('health/env')
export class EnvHealthController {
  @Get()
  get() {
    return { ok: true, env: env.NODE_ENV };
  }
}
