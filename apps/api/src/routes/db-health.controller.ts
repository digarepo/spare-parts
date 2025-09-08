import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { db } from '../db';

@Controller('health/db')
export class DbHealthController {
  @Get()
  async get() {
    // Typed no-op query; throws if DB is down
    await db.execute(sql`select 1`);
    return { ok: true };
  }
}
