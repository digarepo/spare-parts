import { z } from 'zod';

export const ProductStatus = z.enum(['draft', 'active', 'archived']);

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  sku: z.string().min(1).max(64),
  categoryId: z.string().uuid().nullish(),
  currency: z.string().length(3).default('ETB'),
  price: z.coerce.number().min(0).default(0),
  compareAtPrice: z.coerce.number().min(0).optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  attributes: z.record(z.string(), z.unknown()).default({}),
  shortDesc: z.string().max(400).optional(),
  description: z.string().optional(),
  status: ProductStatus.default('draft'),
});

export type ProductCreate = z.infer<typeof ProductCreateSchema>;

export const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(180),
  parentId: z.string().uuid().nullish(),
  description: z.string().optional(),
});

export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

export const ProductUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(64).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  currency: z.string().length(3).optional(),
  price: z.coerce.number().min(0).optional(),
  compareAtPrice: z.coerce.number().min(0).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  shortDesc: z.string().max(400).nullable().optional(),
  description: z.string().nullable().optional(),
  status: ProductStatus.optional(),
});
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;

export const ProductImageCreateSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export type ProductImageCreate = z.infer<typeof ProductImageCreateSchema>;

export const ProductImageUpdateSchema = z.object({
  alt: z.string().max(200).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type ProductImageUpdate = z.infer<typeof ProductImageUpdateSchema>;
