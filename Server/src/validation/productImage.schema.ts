import { z } from 'zod';

export const productIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const imageIdParam = z.object({
  imageId: z.coerce.number().int().positive(),
});

export const reorderImagesSchema = z.object({
  order: z.array(z.coerce.number().int().positive()).min(1).max(16),
});
