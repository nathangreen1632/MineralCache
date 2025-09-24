import { z } from 'zod';

export const updateAdminSettingsSchema = z
  .object({
    // commission
    commissionBps: z.coerce.number().int().min(0).max(10_000).optional(),
    minFeeCents: z.coerce.number().int().min(0).max(100_000_000).optional(),

    // flags
    stripeEnabled: z.coerce.boolean().optional(),

    // currency
    currency: z
      .string()
      .min(3)
      .max(8)
      .transform((s) => s.toLowerCase())
      .optional(),

    // shipping defaults
    shipFlatCents: z.coerce.number().int().min(0).optional(),
    shipPerItemCents: z.coerce.number().int().min(0).optional(),
    shipFreeThresholdCents: z
      .union([z.coerce.number().int().min(0), z.null()])
      .optional(),
    shipHandlingCents: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No changes provided',
    path: ['root'],
  });
