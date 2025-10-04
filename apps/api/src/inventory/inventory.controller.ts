import { Controller, Get, Put, Query, Body, Req, BadRequestException } from '@nestjs/common';
import {
  InventoryGetStockQuerySchema,
  InventorySetStockBodySchema,
  InventoryPermissions,
} from '@spare-parts/contracts/src/inventory';
import type { Request } from 'express';

import { RequirePermissions } from '../auth/permissions.decorator';

import { InventoryService } from './inventory.service';

type AuthUser = { userId: string; tenantId: string; email: string; permissions?: Set<string> };
type AuthRequest = Request & { user: AuthUser };

@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('stock')
  @RequirePermissions(InventoryPermissions.Read)
  async getStock(@Req() req: AuthRequest, @Query() rawQuery: unknown) {
    const parsed = InventoryGetStockQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      // Send useful validation details; avoids 'any' complaints
      throw new BadRequestException({ message: 'Invalid query', issues: parsed.error.issues });
    }
    const tenantId = req.user.tenantId;
    return this.svc.getStock(tenantId, parsed.data);
  }

  @Put('stock')
  @RequirePermissions(InventoryPermissions.Set)
  async setStock(@Req() req: AuthRequest, @Body() rawBody: unknown) {
    const parsed = InventorySetStockBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid body', issues: parsed.error.issues });
    }
    const tenantId = req.user.tenantId;
    return this.svc.setStock(tenantId, req.user, parsed.data);
  }
}
