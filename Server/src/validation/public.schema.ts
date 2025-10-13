import { z } from 'zod';

export const listPublicProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  q: z.string().trim().max(200).optional(),
  onSale: z.coerce.boolean().optional(),
  species: z.string().trim().max(200).optional(),
  synthetic: z.coerce.boolean().optional(),
});
export type ListPublicProductsQuery = z.infer<typeof listPublicProductsQuerySchema>;
