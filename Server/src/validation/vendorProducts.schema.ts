import { z } from 'zod';

export const vendorListProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(25).optional(),
  status: z.enum(['active', 'archived', 'all']).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc']).optional(),
});

export const vendorUpdateProductSchema = z.object({
  onSale: z.boolean().optional(),
  archive: z.boolean().optional(), // true => set archivedAt, false => clear
});
