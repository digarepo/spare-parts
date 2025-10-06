import { Controller, Post, Body, Req } from '@nestjs/common';
import {
  ReserveRequestSchema,
  ReleaseRequestSchema,
  CommitRequestSchema,
  CheckoutPermissions,
} from '@spare-parts/contracts/src/checkout';
import type { Request } from 'express';

import { RequirePermissions } from '../auth/permissions.decorator';

import { CheckoutService } from './checkout.service';

type AuthUser = { userId: string; tenantId: string; email: string; permissions?: Set<string> };
type AuthRequest = Request & { user: AuthUser };

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly svc: CheckoutService) {}

  @Post('reservations') // Reserve / upsert idempotently
  @RequirePermissions(CheckoutPermissions.Reserve)
  async reserve(@Req() req: AuthRequest, @Body() raw: unknown) {
    const body = ReserveRequestSchema.parse(raw);
    const tenantId = req.user.tenantId;
    const result = await this.svc.reserve(tenantId, body);
    return result;
  }

  @Post('reservations/release')
  @RequirePermissions(CheckoutPermissions.Release)
  async release(@Req() req: AuthRequest, @Body() raw: unknown) {
    const body = ReleaseRequestSchema.parse(raw);
    const tenantId = req.user.tenantId;
    return this.svc.release(tenantId, body.key);
  }

  @Post('reservations/commit')
  @RequirePermissions(CheckoutPermissions.Commit)
  async commit(@Req() req: AuthRequest, @Body() raw: unknown) {
    const body = CommitRequestSchema.parse(raw);
    const tenantId = req.user.tenantId;
    return this.svc.commit(tenantId, body.key);
  }
}
