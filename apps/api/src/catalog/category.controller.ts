import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CategoryCreateSchema } from 'packages/contracts/src/catalog';
import { z } from 'zod';

import { JwtGuard } from '../auth/jwt.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

import { CategoryService } from './category.service';

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
    parentId: z.union([z.string().uuid(), z.literal('null')]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .transform((d) => ({
    ...d,
    parentId: d.parentId === 'null' ? null : d.parentId,
  }));

@Controller('catalog')
@UseGuards(JwtGuard, PermissionsGuard)
export class CategoryController {
  @Get('categories')
  @RequirePermissions('catalog.sku.read') // reuse read permission for now
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = ListQuery.parse(query);
    // Build filters object without undefined keys (exactOptionalPropertyTypes-friendly)
    const filters = {
      ...(parsed.q !== undefined ? { q: parsed.q } : {}),
      ...(parsed.parentId !== undefined ? { parentId: parsed.parentId } : {}),
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
    return CategoryService.list(req.user.tenantId, filters);
  }

  @Post('categories')
  @RequirePermissions('catalog.sku.create') // reuse create permission for now
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const dto = CategoryCreateSchema.parse(body);
    try {
      const row = await CategoryService.create(req.user.tenantId, dto);
      return { ok: true, category: row };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('cat_tenant_slug_uq')) return { ok: false, error: 'slug_exists' };
      if (msg === 'invalid_parent') return { ok: false, error: 'invalid_parent' };
      throw e;
    }
  }
}
