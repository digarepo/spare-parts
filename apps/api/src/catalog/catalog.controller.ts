import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProductCreateSchema, ProductUpdateSchema } from 'packages/contracts/src/catalog';
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

const FitmentQuery = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  engine: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

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

  @Get('products/:slug')
  @RequirePermissions('catalog.sku.read')
  async bySlug(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    const product = await CatalogService.getProductBySlug(req.user.tenantId, slug);
    return product ? { ok: true, product } : { ok: false, error: 'not_found' };
  }

  @Get('fitment')
  @RequirePermissions('catalog.sku.read')
  async fitment(@Req() req: AuthedRequest, @Query() query: unknown) {
    const dto = FitmentQuery.parse(query);
    return CatalogService.searchProductsByFitment(req.user.tenantId, dto);
  }

  @Patch('products/:id')
  @RequirePermissions('catalog.sku.update')
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const dto = ProductUpdateSchema.parse(body);
    try {
      const row = await CatalogService.updateProduct(req.user.tenantId, id, dto);
      return { ok: true, product: row };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'not_found') return { ok: false, error: 'not_found' };
      if (msg.includes('prod_tenant_sku_uq')) return { ok: false, error: 'sku_exists' };
      if (msg.includes('prod_tenant_slug_uq')) return { ok: false, error: 'slug_exists' };
      throw e;
    }
  }

  @Delete('products/:id')
  @RequirePermissions('catalog.sku.update')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    try {
      const res = await CatalogService.deleteProduct(req.user.tenantId, id);
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'not_found') return { ok: false, error: 'not_found' };
      throw e;
    }
  }
}
