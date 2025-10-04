import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  type InventoryGetStockQuery as GetStockQuery,
  type InventorySetStockBody as SetStockBody,
  InventoryPermissions,
} from '@spare-parts/contracts/src/inventory';
import { products, inventory } from '@spare-parts/db/src/schema';
import { sql, eq, and } from 'drizzle-orm';

import type { AppDb } from '../db';

type AuthUser = { userId: string; tenantId: string; email: string; permissions?: Set<string> };

@Injectable()
export class InventoryService {
  constructor(@Inject('DB') private readonly db: AppDb) {}

  /**
   * Resolves productId either from explicit productId or from sku.
   * Accepts the exact optional field types (string | undefined) to satisfy exactOptionalPropertyTypes.
   */
  private async resolveProductId(
    tenantId: string,
    input: Pick<GetStockQuery, 'productId' | 'sku'>, // matches zod-inferred shape
  ): Promise<string> {
    if (input.productId == null && input.sku == null) {
      throw new BadRequestException('Provide productId or sku.');
    }

    if (input.productId != null) {
      const [row] = await this.db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!row) throw new NotFoundException('Product not found in this tenant.');
      return input.productId;
    }

    // input.sku is non-null here
    const [row] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, input.sku!))
      .limit(1);

    if (!row) throw new NotFoundException('Product (by sku) not found in this tenant.');
    return row.id;
  }

  async getStock(tenantId: string, query: GetStockQuery) {
    const productId = await this.resolveProductId(tenantId, {
      productId: query.productId,
      sku: query.sku,
    });

    const rows = await this.db
      .select({
        productId: inventory.productId,
        sellerId: inventory.sellerId,
        qty: inventory.qty,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .where(
        and(
          eq(inventory.productId, productId),
          query.sellerId ? eq(inventory.sellerId, query.sellerId) : sql`true`,
        ),
      );

    const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
    return { items: rows, totalQty };
  }

  async setStock(tenantId: string, user: AuthUser, body: SetStockBody) {
    if (body.qty < 0 || !Number.isInteger(body.qty)) {
      throw new BadRequestException('qty must be a non-negative integer.');
    }

    // Only allow setting stock for own org unless user has elevated permission
    const canSetAny = user.permissions?.has(InventoryPermissions.SetAny);
    if (!canSetAny && body.sellerId !== user.tenantId) {
      throw new ForbiddenException('You can only set stock for your own organization.');
    }

    const productId = await this.resolveProductId(tenantId, {
      productId: body.productId,
      sku: body.sku,
    });

    const [row] = await this.db
      .insert(inventory)
      .values({
        tenantId,
        productId,
        sellerId: body.sellerId,
        qty: body.qty,
      })
      .onConflictDoUpdate({
        target: [inventory.tenantId, inventory.productId, inventory.sellerId],
        set: {
          qty: body.qty,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        productId: inventory.productId,
        sellerId: inventory.sellerId,
        qty: inventory.qty,
        updatedAt: inventory.updatedAt,
      });

    if (!row) {
      throw new NotFoundException('Insert/update failed (check product/seller under this tenant).');
    }

    return row;
  }
}
