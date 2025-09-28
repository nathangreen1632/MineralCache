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

/** ── Back-compat aliases (remove once callers are updated) ── */
export const auctionIdParamSchema = bidParamsSchema;
export const placeBidSchema = bidBodySchema;
