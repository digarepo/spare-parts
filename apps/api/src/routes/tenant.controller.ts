import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { tenants } from '@spare-parts/db/src/schema/rbac';
import { eq } from 'drizzle-orm';

import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { db } from '../db';

@Controller('tenants')
@UseGuards(PermissionsGuard)
export class TenantController {
  @Get(':tenantId/overview')
  @RequirePermissions('tenant.read')
  async overview(@Param('tenantId') tenantId: string) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return { ok: true, tenant: tenant ?? null };
  }
}
