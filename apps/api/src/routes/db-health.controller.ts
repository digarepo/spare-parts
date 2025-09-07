import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { pg } from '../db';

@Controller('health/db')
export class DbHealthController {
  @Get()
  async get() {
    try {
      const r = await pg.query('SELECT 1 as ok');
      const ok = r.rows?.[0]?.ok === 1;
      if (!ok) {
        throw new Error('DB ping failed');
      }
      return { ok: true };
    } catch (err) {
      // Return a clear 503 instead of an unhandled 500
      throw new HttpException(
        { ok: false, error: 'DB not reachable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
