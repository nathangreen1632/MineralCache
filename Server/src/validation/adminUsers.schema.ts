// Server/src/validation/adminUsers.schema.ts
import { z } from 'zod';

export const adminPromoteSchema = z.object({
  email: z.string().transform((s) => s.trim().toLowerCase()).pipe(z.email()),
});

export type AdminPromoteDto = z.infer<typeof adminPromoteSchema>;
