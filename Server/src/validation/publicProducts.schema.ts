import { z } from 'zod';

export const listPublicProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc']).default('newest'),
  category: z.string().trim().min(1).optional(),       // slug
  vendorId: z.coerce.number().int().positive().optional(),
  onSale: z.coerce.boolean().optional(),
  priceMin: z.coerce.number().nonnegative().optional(), // dollars
  priceMax: z.coerce.number().nonnegative().optional(), // dollars
  q: z.string().trim().max(200).optional(),
});
export type ListPublicProductsQuery = z.infer<typeof listPublicProductsQuerySchema>;
