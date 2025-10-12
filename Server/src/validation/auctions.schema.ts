// Server/src/validation/auctions.schema.ts
import { z } from 'zod';

/** Route params: /auctions/:id */
export const bidParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Body: POST /auctions/:id/bid */
export const bidBodySchema = z.object({
  amountCents: z.coerce.number().int().positive(),
  maxProxyCents: z.coerce.number().int().positive().optional(),
});

/** Body: POST /auctions (vendor creates an auction) */
const ladderTierSchema = z.object({
  upToCents: z.coerce.number().int().nullable(),
  incrementCents: z.coerce.number().int().positive(),
});

export const createAuctionBodySchema = z.object({
  productId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  startingBidCents: z.coerce.number().int().min(0).default(0),

  // accept number, null, or '' (→ null)
  reserveCents: z
    .union([z.coerce.number().int().min(0), z.null(), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .optional(),

  // accept number, null, or '' (→ null)
  buyNowCents: z
    .union([z.coerce.number().int().min(1), z.null(), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .optional(),

  /** Allowed durations per Week 6 plan — accept "1"/1, "3"/3, "5"/5, "7"/7 */
  durationDays: z
    .union([z.coerce.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => [1, 3, 5, 7].includes(v), { message: 'Duration must be 1, 3, 5, or 7 days' }) as z.ZodType<1 | 3 | 5 | 7>,

  /** Optional custom increment ladder (fallback handled in service if omitted) */
  incrementLadderJson: z.array(ladderTierSchema).max(12).optional(),
});

/** ── Back-compat aliases (remove once callers are updated) ── */
export const auctionIdParamSchema = bidParamsSchema;
export const placeBidSchema = bidBodySchema;

/** ── NEW: pluralized alias + type for param-only routes (non-breaking) ── */
export const auctionIdParamsSchema = bidParamsSchema;
export type AuctionIdParams = z.infer<typeof bidParamsSchema>;
