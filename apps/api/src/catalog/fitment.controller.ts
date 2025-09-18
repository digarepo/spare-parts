import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FitmentAddByTrimIdsSchema, FitmentAddByCriteriaSchema } from '@spare-parts/contracts/src';
import { Request } from 'express';
import { z } from 'zod';

import { JwtGuard } from '../auth/jwt.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

import { FitmentService } from './fitment.service';

type AuthUser = { userId: string; tenantId: string; email: string; permissions?: Set<string> };
interface AuthRequest extends Request {
  user: AuthUser;
}

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
const UuidSchema = z.string().uuid();

// Helpers: strict parsing + error mapping
const parseOrBadRequest = <T>(schema: z.ZodType<T>, input: unknown): T => {
  try {
    return schema.parse(input);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new BadRequestException({ error: 'invalid_request', issues: e.issues });
    }
    throw e;
  }
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
type PgError = { code: string };

const isPgUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e && (e as PgError).code === '23505';
const mapKnownErrors = (e: unknown) => {
  const msg = errMsg(e);
  // duplicate fitment (product_id, trim_id) → conflict
  if (isPgUniqueViolation(e) && msg.includes('pfit_product_trim_uq')) {
    throw new ConflictException({ error: 'fitment_exists' });
  }
  if (msg === 'not_found') {
    throw new NotFoundException({ error: 'not_found' });
  }
  throw e;
};

@Controller('catalog')
@UseGuards(JwtGuard, PermissionsGuard)
export class FitmentController {
  @Get('products/:productId/fitments')
  @RequirePermissions('catalog.sku.read')
  async list(
    @Req() req: AuthRequest,
    @Param('productId') productIdParam: string,
    @Query() query: unknown,
  ): Promise<Awaited<ReturnType<typeof FitmentService.list>>> {
    try {
      const productId = parseOrBadRequest(UuidSchema, productIdParam);
      const dto = parseOrBadRequest(PaginationQuerySchema, query);
      return await FitmentService.list(req.user.tenantId, productId, dto.page, dto.pageSize);
    } catch (e) {
      mapKnownErrors(e);
      return undefined as never;
    }
  }

  @Post('products/:productId/fitments/by-trim-ids')
  @RequirePermissions('catalog.sku.update')
  async addByTrimIds(
    @Req() req: AuthRequest,
    @Param('productId') productIdParam: string,
    @Body() body: unknown,
  ): Promise<Awaited<ReturnType<typeof FitmentService.addByTrimIds>>> {
    try {
      const productId = parseOrBadRequest(UuidSchema, productIdParam);
      const dto = parseOrBadRequest(FitmentAddByTrimIdsSchema, body);
      return await FitmentService.addByTrimIds(req.user.tenantId, productId, dto.trimIds);
    } catch (e) {
      mapKnownErrors(e);
      return undefined as never;
    }
  }

  @Post('products/:productId/fitments/by-criteria')
  @RequirePermissions('catalog.sku.update')
  async addByCriteria(
    @Req() req: AuthRequest,
    @Param('productId') productIdParam: string,
    @Body() body: unknown,
  ): Promise<Awaited<ReturnType<typeof FitmentService.addByCriteria>>> {
    try {
      const productId = parseOrBadRequest(UuidSchema, productIdParam);
      const dto = parseOrBadRequest(FitmentAddByCriteriaSchema, body);
      return await FitmentService.addByCriteria(req.user.tenantId, productId, dto);
    } catch (e) {
      mapKnownErrors(e);
      return undefined as never;
    }
  }

  @Delete('products/:productId/fitments/:trimId')
  @RequirePermissions('catalog.sku.update')
  async remove(
    @Req() req: AuthRequest,
    @Param('productId') productIdParam: string,
    @Param('trimId') trimIdParam: string,
  ): Promise<Awaited<ReturnType<typeof FitmentService.remove>>> {
    try {
      const productId = parseOrBadRequest(UuidSchema, productIdParam);
      const trimId = parseOrBadRequest(UuidSchema, trimIdParam);
      return await FitmentService.remove(req.user.tenantId, productId, trimId);
    } catch (e) {
      mapKnownErrors(e);
      return undefined as never;
    }
  }
}
