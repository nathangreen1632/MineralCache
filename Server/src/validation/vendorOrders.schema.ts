// Server/src/validation/vendorOrders.schema.ts
import { z } from 'zod';

// Path params: /api/vendor/orders/:id/...
export const vendorOrderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type VendorOrderIdParam = z.infer<typeof vendorOrderIdParamSchema>;

// Query: e.g. ?itemIds=12,13,99  (optional)
export const vendorPackingSlipQuerySchema = z.object({
  itemIds: z
    .string()
    .trim()
    .regex(/^\d+(,\d+)*$/, 'itemIds must be a comma-separated list of numeric IDs')
    .optional(),
});
export type VendorPackingSlipQuery = z.infer<typeof vendorPackingSlipQuerySchema>;
