// Server/src/validation/fields.ts
import { z } from 'zod';

export const Email = (z as any).email ? (z as any).email() : z.string().email();
