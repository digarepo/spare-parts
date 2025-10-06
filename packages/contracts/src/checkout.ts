import { z } from 'zod';

export const CheckoutPermissions = {
  Reserve: 'checkout.reserve',
  Release: 'checkout.release',
  Commit: 'checkout.commit',
} as const;

export const ReservationItemInput = z
  .object({
    productId: z.uuid().optional(),
    sku: z.string().min(1).optional(),
    sellerId: z.uuid(),
    qty: z.number().int().min(1),
  })
  .refine((d) => d.productId || d.sku, { message: 'Provide productId or sku.' });

export const ReserveRequestSchema = z.object({
  key: z.string().min(8), // client idempotency key
  ttlSec: z
    .number()
    .int()
    .min(30)
    .max(60 * 60)
    .optional(), // default 10 min
  items: z.array(ReservationItemInput).min(1),
});

export const ReservationItemSchema = z.object({
  productId: z.uuid(),
  sellerId: z.uuid(),
  qty: z.number().int().min(1),
});

export const ReservationSchema = z.object({
  key: z.string(),
  status: z.enum(['active', 'released', 'committed']),
  items: z.array(ReservationItemSchema),
  expiresAt: z.iso.datetime().nullable().optional(),
  committedAt: z.iso.datetime().nullable().optional(),
  releasedAt: z.iso.datetime().nullable().optional(),
});

export const ReleaseRequestSchema = z.object({
  key: z.string().min(8),
});

export const CommitRequestSchema = z.object({
  key: z.string().min(8),
});

export type ReserveRequest = z.infer<typeof ReserveRequestSchema>;
export type ReservationItemInputT = z.infer<typeof ReservationItemInput>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type ReleaseRequest = z.infer<typeof ReleaseRequestSchema>;
export type CommitRequest = z.infer<typeof CommitRequestSchema>;
