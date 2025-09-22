// Server/src/validation/cart.schema.ts
import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99),
});

// Full replace of cart items (Week-2)
export const updateCartSchema = z.object({
  items: z.array(cartItemSchema).max(100).default([]),
});
