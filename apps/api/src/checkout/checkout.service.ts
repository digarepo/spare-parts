import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import type { ReserveRequest, Reservation } from '@spare-parts/contracts/src/checkout';
import { products } from '@spare-parts/db/src/schema';
import { reservations, reservationItems } from '@spare-parts/db/src/schema/reservations';
import { sql, and, eq, inArray } from 'drizzle-orm';

import type { AppDb } from '../db';

type InvRow = { qty: number };
type ActiveReservedRow = { active_reserved: number };
type ReservationIdRow = { id: string };
type ReservationStatusRow = { status: 'active' | 'released' | 'committed' };

@Injectable()
export class CheckoutService {
  constructor(@Inject('DB') private readonly db: AppDb) {}

  private async resolveProductIds(tenantId: string, items: ReserveRequest['items']) {
    // Resolve productId for items that provide sku
    const skus = items.filter((i) => !i.productId && i.sku).map((i) => i.sku!);
    let skuMap = new Map<string, string>();
    if (skus.length) {
      const rows = await this.db
        .select({ id: products.id, sku: products.sku })
        .from(products)
        .where(inArray(products.sku, skus));
      skuMap = new Map(rows.map((r) => [r.sku, r.id]));
    }
    return items.map((i) => ({
      productId: i.productId ?? skuMap.get(i.sku!),
      sellerId: i.sellerId,
      qty: i.qty,
    }));
  }

  private async buildReservationResponse(tenantId: string, key: string): Promise<Reservation> {
    const [r] = await this.db
      .select({
        key: reservations.key,
        status: reservations.status,
        expiresAt: reservations.expiresAt,
        committedAt: reservations.committedAt,
        releasedAt: reservations.releasedAt,
        id: reservations.id,
      })
      .from(reservations)
      .where(and(eq(reservations.tenantId, tenantId), eq(reservations.key, key)))
      .limit(1);

    if (!r) throw new NotFoundException('Reservation not found.');

    const items = await this.db
      .select({
        productId: reservationItems.productId,
        sellerId: reservationItems.sellerId,
        qty: reservationItems.qty,
      })
      .from(reservationItems)
      .where(
        and(eq(reservationItems.tenantId, tenantId), eq(reservationItems.reservationId, r.id)),
      );

    return {
      key: r.key,
      status: r.status as Reservation['status'],
      items,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      committedAt: r.committedAt ? r.committedAt.toISOString() : null,
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
    };
  }

  async reserve(tenantId: string, body: ReserveRequest): Promise<Reservation> {
    const ttlSec = body.ttlSec ?? 600; // default 10 minutes
    if (ttlSec < 30 || ttlSec > 3600)
      throw new BadRequestException('ttlSec out of range (30..3600).');

    const items = await this.resolveProductIds(tenantId, body.items);
    if (items.some((i) => !i.productId))
      throw new NotFoundException('One or more products (by sku) not found.');

    return this.db.transaction(async (tx) => {
      // Upsert reservation idempotently
      await tx.execute(sql`
        INSERT INTO reservations (id, tenant_id, key, status, expires_at)
        VALUES (gen_random_uuid(), ${tenantId}::uuid, ${body.key}, 'active', now() + (${ttlSec} || ' seconds')::interval)
        ON CONFLICT (tenant_id, key) DO NOTHING
      `);

      const resLoad = await tx
        .select({ id: reservations.id, status: reservations.status })
        .from(reservations)
        .where(and(eq(reservations.tenantId, tenantId), eq(reservations.key, body.key)))
        .limit(1);
      const resRow = resLoad[0] as (ReservationIdRow & ReservationStatusRow) | undefined;

      if (!resRow) throw new NotFoundException('Failed to create or load reservation.');
      if (resRow.status === 'committed' || resRow.status === 'released') {
        // Idempotent return
        return this.buildReservationResponse(tenantId, body.key);
      }

      // Refresh expiry
      await tx
        .update(reservations)
        .set({ expiresAt: sql`now() + (${ttlSec} || ' seconds')::interval`, updatedAt: sql`now()` })
        .where(and(eq(reservations.id, resRow.id), eq(reservations.tenantId, tenantId)));

      // For each item: lock inventory row and ensure available >= requested
      for (const it of items) {
        // Lock inventory row
        const invRes = (await tx.execute(sql`
          SELECT qty FROM inventory
          WHERE tenant_id = ${tenantId}::uuid AND product_id = ${it.productId}::uuid AND seller_id = ${it.sellerId}::uuid
          FOR UPDATE
        `)) as { rowCount: number; rows: InvRow[] };

        if (invRes.rowCount === 0)
          throw new NotFoundException('Inventory row not found for product/seller.');
        const onHand = Number(invRes.rows[0]?.qty ?? 0);

        // Active reservations excluding this key
        const activeRes = (await tx.execute(sql`
          SELECT COALESCE(SUM(ri.qty), 0)::int AS active_reserved
          FROM reservation_items ri
          JOIN reservations r
            ON r.id = ri.reservation_id
          WHERE r.tenant_id = ${tenantId}::uuid
            AND r.status = 'active'
            AND (r.expires_at IS NULL OR r.expires_at > now())
            AND ri.product_id = ${it.productId}::uuid
            AND ri.seller_id = ${it.sellerId}::uuid
            AND r.key <> ${body.key}
        `)) as { rows: ActiveReservedRow[] };

        const activeReserved = Number(activeRes.rows[0]?.active_reserved ?? 0);
        const available = onHand - activeReserved;

        if (available < it.qty) {
          throw new ConflictException(
            `Insufficient available stock (available=${available}, need=${it.qty}).`,
          );
        }

        // Upsert reservation line (idempotent per reservation)
        await tx.execute(sql`
          INSERT INTO reservation_items (id, tenant_id, reservation_id, product_id, seller_id, qty)
          VALUES (gen_random_uuid(), ${tenantId}::uuid, ${resRow.id}::uuid, ${it.productId}::uuid, ${it.sellerId}::uuid, ${it.qty})
          ON CONFLICT (tenant_id, reservation_id, product_id, seller_id)
          DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()
        `);
      }

      return this.buildReservationResponse(tenantId, body.key);
    });
  }

  async release(tenantId: string, key: string): Promise<Reservation> {
    // Idempotent: only transition from active -> released
    const { rowCount } = (await this.db.execute(sql`
  UPDATE reservations
  SET status = 'released', released_at = now(), updated_at = now()
  WHERE tenant_id = ${tenantId}::uuid AND key = ${key} AND status = 'active'
`)) as { rowCount: number };

    if (rowCount === 0) {
      const exists = await this.db
        .select({ id: reservations.id })
        .from(reservations)
        .where(and(eq(reservations.tenantId, tenantId), eq(reservations.key, key)))
        .limit(1);
      if (!exists.length) throw new NotFoundException('Reservation not found.');
    }

    // If no rows updated, could be already released/committed or not found; return current state if exists
    const exists = await this.db
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.tenantId, tenantId), eq(reservations.key, key)))
      .limit(1);

    if (!exists.length) throw new NotFoundException('Reservation not found.');
    return this.buildReservationResponse(tenantId, key);
  }

  async commit(tenantId: string, key: string): Promise<Reservation> {
    return this.db.transaction(async (tx) => {
      // Atomic state transition: only one commit wins
      const transition = (await tx.execute(sql`
        UPDATE reservations
        SET status = 'committed', committed_at = now(), updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND key = ${key} AND status = 'active'
      `)) as { rowCount: number };

      if (transition.rowCount === 0) {
        // Already committed or released (idempotent), or not found
        const resStatus = await tx
          .select({ status: reservations.status })
          .from(reservations)
          .where(and(eq(reservations.tenantId, tenantId), eq(reservations.key, key)))
          .limit(1);
        const existing = resStatus[0] as ReservationStatusRow | undefined;

        if (!existing) throw new NotFoundException('Reservation not found.');
        if (existing.status === 'committed') return this.buildReservationResponse(tenantId, key);
        throw new ConflictException('Reservation is not active (already released or committed).');
      }

      // Decrement inventory per item guarded by qty >= needed
      const resIdRow = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(and(eq(reservations.tenantId, tenantId), eq(reservations.key, key)))
        .limit(1);
      const r = resIdRow[0] as ReservationIdRow | undefined;
      if (!r) throw new NotFoundException('Reservation not found after commit transition.');

      const lines = await tx
        .select({
          productId: reservationItems.productId,
          sellerId: reservationItems.sellerId,
          qty: reservationItems.qty,
        })
        .from(reservationItems)
        .where(
          and(eq(reservationItems.tenantId, tenantId), eq(reservationItems.reservationId, r.id)),
        );

      for (const ln of lines) {
        const update = (await tx.execute(sql`
          UPDATE inventory
          SET qty = qty - ${ln.qty}, updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND product_id = ${ln.productId}::uuid
            AND seller_id = ${ln.sellerId}::uuid
            AND qty >= ${ln.qty}
        `)) as { rowCount: number };

        if (update.rowCount === 0) {
          // Not enough on-hand (e.g., manual stock adjustment) → fail entire commit (no double-decrement)
          throw new ConflictException('Insufficient on-hand during commit; inventory changed.');
        }
      }

      // Success → idempotent result
      return this.buildReservationResponse(tenantId, key);
    });
  }
}
