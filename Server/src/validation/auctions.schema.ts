import { z } from 'zod';

export const auctionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const placeBidSchema = z.object({
  // For scaffolding, require a concrete bid; proxy logic comes later.
  amountCents: z.coerce.number().int().min(1, 'amountCents must be ≥ 1'),
});
