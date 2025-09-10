import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { tenants } from '@spare-parts/db/src/schema/rbac';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';

import { JwtGuard } from '../auth/jwt.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { withTenantDb } from '../db';

@Controller('tenants')
@UseGuards(JwtGuard, PermissionsGuard)
export class TenantController {
  @Get(':tenantId/overview')
  @RequirePermissions('tenant.read')
  async overview(
    @Param('tenantId', new ParseUUIDPipe({ version: '4' })) tenantId: string,
    @Req() req: Request,
  ) {
    const userTenantId = req.user?.tenantId;
    if (!userTenantId) {
      throw new ForbiddenException('Auth context missing');
    }
    if (tenantId !== userTenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return withTenantDb(userTenantId, async (rdb) => {
      const [tenant] = await rdb.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      return { ok: true, tenant: tenant ?? null };
    });
  }
}
