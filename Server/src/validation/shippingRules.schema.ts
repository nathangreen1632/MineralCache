import { z } from 'zod';

const cents = z.number().int().min(0);

export const createShippingRuleSchema = z.object({
  vendorId: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  baseCents: cents,
  perItemCents: cents.default(0),
  perWeightCents: cents.default(0), // if you later add weight on products
  minCents: cents.optional(),
  maxCents: cents.optional(),
  priority: z.number().int().min(0).max(100000).default(100),
  active: z.boolean().default(true),
  isDefaultGlobal: z.boolean().default(false),
});

export const updateShippingRuleSchema = createShippingRuleSchema.partial();

export type CreateShippingRuleInput = z.infer<typeof createShippingRuleSchema>;
export type UpdateShippingRuleInput = z.infer<typeof updateShippingRuleSchema>;
