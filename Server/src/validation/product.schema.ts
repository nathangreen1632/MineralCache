// Server/src/validation/product.schema.ts
import { z } from 'zod';

/** Common field shapes (no deprecated APIs) */
const id = z.coerce.number().int().positive();

const cents = z.coerce.number().int().min(0);
const nonEmpty = z.string().trim().min(1);

/** Create payload (vendor) */
export const createProductSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(5000).optional().nullable(),

  species: nonEmpty.max(140),
  locality: z.string().trim().max(200).optional().nullable(),
  size: z.string().trim().max(120).optional().nullable(),          // e.g., "35 x 22 x 18 mm"
  weight: z.string().trim().max(120).optional().nullable(),        // e.g., "24.3 g"
  fluorescence: z.string().trim().max(120).optional().nullable(),
  condition: z.string().trim().max(200).optional().nullable(),
  provenance: z.string().trim().max(500).optional().nullable(),

  synthetic: z.coerce.boolean().optional().default(false),
  onSale: z.coerce.boolean().optional().default(false),

  priceCents: cents,
  compareAtCents: cents.optional().nullable(),

  // TODO(images): Accept image ids/paths once uploader returns references
  images: z.array(z.string().trim().max(500)).max(4).optional(),
});

/** Update payload (vendor) — all optional; must include at least one field */
export const updateProductSchema = createProductSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });

/** Archive = soft delete */
export const archiveProductSchema = z.object({
  id,
});

/** Public list filters + sorting */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),

  vendorId: z.coerce.number().int().positive().optional(),
  vendorSlug: z.string().trim().max(140).optional(),
  species: z.string().trim().max(140).optional(),
  synthetic: z.coerce.boolean().optional(),
  onSale: z.coerce.boolean().optional(),

  sort: z
    .enum(['newest', 'price_asc', 'price_desc'])
    .optional()
    .default('newest'),

  // Optional price filtering (in cents)
  minCents: cents.optional(),
  maxCents: cents.optional(),
});

/** Path param id */
export const productIdParamSchema = z.object({
  id,
});
