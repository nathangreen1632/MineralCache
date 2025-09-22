// Server/src/validation/vendor.schema.ts
import { z } from 'zod';

export const applyVendorSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(5000).optional().nullable(),
  logoUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => v == null || z.url().safeParse(v).success, { message: 'Invalid URL' }),
  country: z.string().length(2).optional().nullable(),
});

export const adminListVendorsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const adminRejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
