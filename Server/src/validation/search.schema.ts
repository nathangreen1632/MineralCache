// Server/src/validation/search.schema.ts
import { z } from 'zod';

export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(240),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
  // Optional vendor scope (mirrors products.list)
  vendorId: z.coerce.number().int().positive().optional(),
  vendorSlug: z.string().trim().max(140).optional(),
});
