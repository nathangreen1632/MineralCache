// Server/src/validation/adminOrders.schema.ts
import { z } from 'zod';

export const adminListOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(25).optional(),
  status: z.enum(['pending_payment', 'paid', 'failed', 'cancelled', 'refunded']).optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  buyerId: z.coerce.number().int().positive().optional(),
  paymentIntentId: z.string().trim().max(200).optional(),
  // Accepts YYYY-MM-DD or ISO timestamps; controller does validation/bounds.
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc']).optional(),
});

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersSchema>;

export const adminOrderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type AdminOrderIdParam = z.infer<typeof adminOrderIdParamSchema>;

/** Back-compat alias for older imports (do not remove unless all refs are updated). */
export const adminListOrdersQuerySchema = adminListOrdersSchema;
