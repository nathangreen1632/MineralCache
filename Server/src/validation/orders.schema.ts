// Server/src/validation/orders.schema.ts
import { z } from 'zod';

export const shipOrderSchema = z.object({
  carrier: z.enum(['usps', 'ups', 'fedex', 'dhl', 'other']),
  // When provided, must be non-empty after trim; still optional/nullable.
  tracking: z.string().trim().min(1).max(64).optional().nullable(),
  // If supplied, must contain at least one positive id.
  itemIds: z.array(z.number().int().positive()).min(1).optional(),
});

export const deliverOrderSchema = z.object({
  // If supplied, must contain at least one positive id.
  itemIds: z.array(z.number().int().positive()).min(1).optional(),
});

export type ShipOrderInput = z.infer<typeof shipOrderSchema>;
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;
