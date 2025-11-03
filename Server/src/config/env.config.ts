import { z } from 'zod';

/** Parse + validate env. Keep strings in process.env; expose typed helpers here. */
const envSchema = z.object({
  EMAIL_ENABLED: z.string().optional().default('false'),
  RESEND_API_KEY: z.string().optional(),

  TAX_ENABLED: z.string().optional().default('false'),
  TAX_RATE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  TAX_LABEL: z.string().optional().default('Sales tax'),

  CURRENCY: z.enum(['usd']).optional().default('usd'),

  SHIP_FLAT_CENTS: z.coerce.number().int().min(0).optional().default(0),
  SHIP_PER_ITEM_CENTS: z.coerce.number().int().min(0).optional().default(0),
  SHIP_FREE_THRESHOLD_CENTS: z
    .union([z.coerce.number().int().min(0), z.string().length(0)])
    .optional()
    .default(''),
  SHIP_HANDLING_CENTS: z
    .union([z.coerce.number().int().min(0), z.string().length(0)])
    .optional()
    .default(''),

  BRAND_NAME: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

function asBool(v: string | undefined) {
  return v === '1' || (v ?? '').toLowerCase() === 'true';
}

export const env = {
  emailEnabled: asBool(parsed.EMAIL_ENABLED),
  resendApiKey: parsed.RESEND_API_KEY ?? '',

  taxEnabled: asBool(parsed.TAX_ENABLED),
  taxRateBps: parsed.TAX_RATE_BPS,
  taxLabel: parsed.TAX_LABEL,

  currency: parsed.CURRENCY,

  shipFlatCents: parsed.SHIP_FLAT_CENTS,
  shipPerItemCents: parsed.SHIP_PER_ITEM_CENTS,
  shipFreeThresholdCents:
    parsed.SHIP_FREE_THRESHOLD_CENTS === '' ? null : Number(parsed.SHIP_FREE_THRESHOLD_CENTS),
  shipHandlingCents:
    parsed.SHIP_HANDLING_CENTS === '' ? null : Number(parsed.SHIP_HANDLING_CENTS),

  brandName: parsed.BRAND_NAME || 'Mineral Cache',
  emailFrom: parsed.EMAIL_FROM || 'no-reply@mineralcache.com',
} as const;
