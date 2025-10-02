// Server/src/validation/vendorOrders.schema.ts
import { z } from 'zod';

// e.g. ?itemIds=12,13,99  (optional)
export const vendorPackingSlipQuerySchema = z.object({
  itemIds: z
    .string()
    .trim()
    .regex(/^\d+(,\d+)*$/, 'itemIds must be a comma-separated list of numeric IDs')
    .optional(),
});