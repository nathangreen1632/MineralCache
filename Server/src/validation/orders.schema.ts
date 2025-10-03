// Server/src/validation/orders.schema.ts
import { z } from 'zod';

export const shipOrderSchema = z.object({
  carrier: z.enum(['usps', 'ups', 'fedex', 'dhl', 'other']),
  tracking: z.string().trim().max(64).optional().nullable(), // allow empty/null
  itemIds: z.array(z.number().int().positive()).optional(),  // optional subset (vendor can restrict)
});

export const deliverOrderSchema = z.object({
  itemIds: z.array(z.number().int().positive()).optional(),  // optional subset
});

export type ShipOrderInput = z.infer<typeof shipOrderSchema>;
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;
