import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProductCreateSchema } from 'packages/contracts/src/catalog';
import { z } from 'zod';

import { JwtGuard } from '../auth/jwt.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

import { CatalogService, type ListFilters } from './catalog.service';

type AuthUser = {
  userId: string;
  tenantId: string;
  email: string;
  permissions?: Set<string>;
};
type AuthedRequest = Request & { user: AuthUser };

const ListQuery = z
  .object({
    q: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    categoryId: z.union([z.string().uuid(), z.literal('null')]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .transform((d) => ({
    ...d,
    categoryId: d.categoryId === 'null' ? null : d.categoryId,
  }));

@Controller('catalog')
@UseGuards(JwtGuard, PermissionsGuard)
export class CatalogController {
  @Get('products')
  @RequirePermissions('catalog.sku.read')
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = ListQuery.parse(query);

    // Build a filters object that OMITS undefined keys (important for exactOptionalPropertyTypes)
    const filters: ListFilters = {
      ...(parsed.q !== undefined ? { q: parsed.q } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
      page: parsed.page,
      pageSize: parsed.pageSize,
    };

    return CatalogService.listProducts(req.user.tenantId, filters);
  }

  @Post('products')
  @RequirePermissions('catalog.sku.create')
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const dto = ProductCreateSchema.parse(body);
    try {
      const row = await CatalogService.createProduct(req.user.tenantId, dto);
      return { ok: true, product: row };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('prod_tenant_sku_uq')) return { ok: false, error: 'sku_exists' };
      if (msg.includes('prod_tenant_slug_uq')) return { ok: false, error: 'slug_exists' };
      throw e;
    }
  }
}
