import { z } from 'zod';

const cents = z.coerce.number().int().min(0);

export const createShippingRuleSchema = z
  .object({
    vendorId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    label: z.string().trim().min(1).max(120).default('Shipping').optional(),

    baseCents: cents.default(0),
    perItemCents: cents.default(0),
    perWeightCents: cents.default(0),

    minCents: cents.nullable().optional(),
    maxCents: cents.nullable().optional(),
    freeThresholdCents: cents.nullable().optional(),

    priority: z.coerce.number().int().min(0).max(100000).default(100).optional(),
    active: z.coerce.boolean().default(true).optional(),
    isDefaultGlobal: z.coerce.boolean().default(false).optional(),
  })
  .refine(
    (d) => (d.minCents == null || d.maxCents == null ? true : d.maxCents >= d.minCents),
    { path: ['maxCents'], message: 'maxCents must be ≥ minCents' }
  );

export const updateShippingRuleSchema = createShippingRuleSchema.partial();

export type CreateShippingRuleInput = z.infer<typeof createShippingRuleSchema>;
export type UpdateShippingRuleInput = z.infer<typeof updateShippingRuleSchema>;
