import { z } from 'zod';

/** Permission keys (shared across API/Web) */
export const InventoryPermissions = {
  Read: 'inventory.read',
  Set: 'inventory.set',
  SetAny: 'inventory.set:any',
} as const;

/** GET /inventory/stock?productId|sku[&sellerId] */
export const InventoryGetStockQuerySchema = z
  .object({
    productId: z.uuid().optional(),
    sku: z.string().min(1).optional(),
    sellerId: z.uuid().optional(),
  })
  .refine((d) => d.productId || d.sku, { message: 'Provide productId or sku.' });

/** One stock row (per seller) */
export const InventoryItemSchema = z.object({
  productId: z.uuid(),
  sellerId: z.uuid(),
  qty: z.number().int().min(0),
  // API will serialize Date → ISO string. Keep contract as string.
  updatedAt: z.iso.datetime().optional(),
});

export const InventoryGetStockResponseSchema = z.object({
  items: z.array(InventoryItemSchema),
  totalQty: z.number().int().min(0),
});

/** PUT /inventory/stock */
export const InventorySetStockBodySchema = z
  .object({
    productId: z.uuid().optional(),
    sku: z.string().min(1).optional(),
    sellerId: z.uuid(),
    qty: z.coerce.number().int().min(0),
  })
  .refine((d) => d.productId || d.sku, { message: 'Provide productId or sku.' });

/** Inferred TS types */
export type InventoryGetStockQuery = z.infer<typeof InventoryGetStockQuerySchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type InventoryGetStockResponse = z.infer<typeof InventoryGetStockResponseSchema>;
export type InventorySetStockBody = z.infer<typeof InventorySetStockBodySchema>;
