import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';

import { PermissionsGuard } from '../auth/permissions.guard';

type UserCtx = { user?: { userId: string; tenantId: string; permissions: Set<string> } };

@Controller('me')
@UseGuards(PermissionsGuard)
export class MeController {
  @Get('permissions')
  getPerms(@Req() req: Request & UserCtx) {
    const perms = Array.from(req.user?.permissions ?? []);
    return { ok: true, userId: req.user?.userId, tenantId: req.user?.tenantId, permissions: perms };
  }
}
