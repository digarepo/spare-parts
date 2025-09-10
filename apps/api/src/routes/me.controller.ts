import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { JwtGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

type ReqUser = { userId: string; tenantId: string; permissions: Set<string> };
type PermRequest = Request & { user?: ReqUser };

@Controller('me')
@UseGuards(JwtGuard, PermissionsGuard)
export class MeController {
  @Get('permissions')
  getPerms(@Req() req: PermRequest) {
    const perms = Array.from(req.user?.permissions ?? []);
    return { ok: true, userId: req.user?.userId, tenantId: req.user?.tenantId, permissions: perms };
  }
}
