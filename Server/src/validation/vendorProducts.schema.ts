// Server/src/validation/vendorProducts.schema.ts
import { z } from 'zod';

/** Query: vendor products list (used by validateQuery → res.locals.query) */
export const listVendorProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  // 🔧 include 'oldest' so controller comparisons type-check
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc']).default('newest'),
  status: z.enum(['active', 'archived', 'all']).optional(),
  q: z.string().trim().max(200).optional(),
});
export type ListVendorProductsQuery = z.infer<typeof listVendorProductsQuerySchema>;

/** Body: update flags for a single vendor product
 *  - supports legacy `archive` but normalizes to `archived`
 */
const flagsBase = z.object({
  onSale: z.boolean().optional(),
  archived: z.boolean().optional(),
  // legacy input; will be mapped to `archived`
  archive: z.boolean().optional(),
});

export const updateVendorProductFlagsSchema = flagsBase
  .refine(
    (v) => v.onSale !== undefined || v.archived !== undefined || v.archive !== undefined,
    { message: 'Provide at least one of { onSale, archived }' }
  )
  .transform((v) => ({
    onSale: v.onSale,
    archived: v.archived ?? v.archive,
  }));

export type UpdateVendorProductFlags = z.infer<typeof updateVendorProductFlagsSchema>;
