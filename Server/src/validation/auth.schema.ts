// Server/src/validation/auth.schema.ts
import { z } from 'zod';

// Helpers (new-style Zod)
const email = z.email().min(3).max(254);
const password = z.string().min(8).max(128);
const name = z.string().trim().max(80);

// Accept either ISO `dateOfBirth` or `dob` in DD-MM-YYYY; require at least one.
const dobDdMmYyyy = z
  .string()
  .regex(/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/, 'Expected DD-MM-YYYY');

/** Normalize to YYYY-MM-DD, or null if invalid */
export function normalizeDob(input: { dateOfBirth?: string; dob?: string }): string | null {
  if (input?.dob) {
    const [ddS, mmS, yyyyS] = input.dob.split('-');
    const dd = Number(ddS);
    const mm = Number(mmS);
    const yyyy = Number(yyyyS);
    if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return null;

    // Calendar-accurate check
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
    const ok =
      dt.getUTCFullYear() === yyyy &&
      dt.getUTCMonth() + 1 === mm &&
      dt.getUTCDate() === dd;
    if (!ok) return null;

    const mm2 = String(mm).padStart(2, '0');
    const dd2 = String(dd).padStart(2, '0');
    return `${yyyy}-${mm2}-${dd2}`;
  }
  if (input?.dateOfBirth) {
    const dt = new Date(input.dateOfBirth);
    if (Number.isNaN(dt.getTime())) return null;
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${dt.getUTCFullYear()}-${mm}-${dd}`;
  }
  return null;
}

export const verify18Schema = z
  .object({
    // Non-deprecated: z.iso.datetime()
    dateOfBirth: z.iso.datetime().optional(), // RFC 3339
    dob: dobDdMmYyyy.optional(),              // DD-MM-YYYY
  })
  .refine((v) => Boolean(v.dateOfBirth ?? v.dob), {
    message: 'Provide either `dateOfBirth` (ISO) or `dob` (DD-MM-YYYY)',
    path: ['dob'],
  })
  .superRefine((v, ctx) => {
    // If provided, the value must normalize to a valid calendar date.
    if (v.dateOfBirth || v.dob) {
      const ymd = normalizeDob(v);
      if (!ymd) {
        ctx.addIssue({
          code: 'custom', // raw string (no ZodIssueCode)
          path: v.dob ? ['dob'] : ['dateOfBirth'],
          message: v.dob ? 'Invalid calendar date (DD-MM-YYYY)' : 'Invalid ISO date',
        });
      }
    }
  });

export const loginSchema = z.object({
  email,
  password,
});

export const registerSchema = z.object({
  email,
  password,
  name: name.optional(),
});

// Type used by controllers
export type Verify18Body = z.infer<typeof verify18Schema>;
