// Server/src/validation/adminOrders.schema.ts
import { z } from 'zod';

export const adminListOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(25).optional(),
  status: z.enum(['pending_payment', 'paid', 'failed', 'cancelled']).optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  buyerId: z.coerce.number().int().positive().optional(),
  paymentIntentId: z.string().trim().max(200).optional(),
  dateFrom: z.string().trim().optional(), // ISO date (YYYY-MM-DD or ISO timestamp)
  dateTo: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc']).optional(),
});

export const adminOrderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
