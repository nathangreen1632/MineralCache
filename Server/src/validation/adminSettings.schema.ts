// Server/src/validation/adminSettings.schema.ts
import { z } from 'zod';

/** Incoming payload from Admin UI (camelCase) */
export const updateAdminSettingsSchema = z
  .object({
    // commission
    commissionBps: z.coerce.number().int().min(0).max(10_000).optional(),
    minFeeCents: z.coerce.number().int().min(0).max(100_000_000).optional(),

    // flags (feature flags like TAX_ENABLED remain in ENV)
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
    shipFreeThresholdCents: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
    shipHandlingCents: z.union([z.coerce.number().int().min(0), z.null()]).optional(),

    // tax settings (rate/label are editable; enable flag is ENV-driven)
    taxRateBps: z.coerce.number().int().min(0).max(10_000).optional(), // up to 100%
    taxLabel: z.string().max(64).nullable().optional(),

    // branding/email
    brandName: z.string().min(1).max(80).optional(),
    emailFrom: z.email().optional(), // ✅ Zod v4
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No changes provided',
    path: ['root'],
  });

export type UpdateAdminSettingsDto = z.infer<typeof updateAdminSettingsSchema>;

export function toAdminSettingsModelPatch(input: UpdateAdminSettingsDto) {
  return {
    commission_bps: input.commissionBps,
    min_fee_cents: input.minFeeCents,
    stripe_enabled: input.stripeEnabled,
    currency: input.currency,

    ship_flat_cents: input.shipFlatCents,
    ship_per_item_cents: input.shipPerItemCents,
    ship_free_threshold_cents: input.shipFreeThresholdCents ?? null,
    ship_handling_cents: input.shipHandlingCents ?? null,

    tax_rate_bps: input.taxRateBps,
    tax_label: input.taxLabel ?? null,

    brandName: input.brandName,
    emailFrom: input.emailFrom,
  } as const;
}
