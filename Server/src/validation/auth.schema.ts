// Server/src/validation/auth.schema.ts
import { z } from 'zod';

// --------------------- Common fields ---------------------
const email = z.email().min(3).max(254);
const password = z.string().min(8).max(128);
const name = z.string().trim().max(80);

// Legacy: DD-MM-YYYY (kept for compatibility)
const dobDdMmYyyy = z
  .string()
  .regex(/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/, 'Expected DD-MM-YYYY');

// New: YYYY-MM-DD
const dobYyyyMmDd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// --------------------- Helpers ---------------------
function isCalendarValid(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

function partsToYmd(y: number, m: number, d: number): string | null {
  if (!isCalendarValid(y, m, d)) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Normalize any accepted input to YYYY-MM-DD, or null if invalid. */
export function normalizeDob(input: any): string | null {
  if (!input || typeof input !== 'object') return null;

  // 1) New: year/month/day (numbers or numeric strings)
  if (
    Object.prototype.hasOwnProperty.call(input, 'year') &&
    Object.prototype.hasOwnProperty.call(input, 'month') &&
    Object.prototype.hasOwnProperty.call(input, 'day')
  ) {
    const y = Number(input.year);
    const m = Number(input.month);
    const d = Number(input.day);
    return partsToYmd(y, m, d);
  }

  // 2) dob: 'YYYY-MM-DD'
  if (typeof input.dob === 'string' && dobYyyyMmDd.safeParse(input.dob).success) {
    const [yS, mS, dS] = input.dob.split('-');
    return partsToYmd(Number(yS), Number(mS), Number(dS));
  }

  // 3) Legacy: dob: 'DD-MM-YYYY'
  if (typeof input.dob === 'string' && dobDdMmYyyy.safeParse(input.dob).success) {
    const [ddS, mmS, yyyyS] = input.dob.split('-');
    return partsToYmd(Number(yyyyS), Number(mmS), Number(ddS));
  }

  // 4) Legacy: dateOfBirth: ISO/RFC3339
  if (typeof input.dateOfBirth === 'string') {
    const dt = new Date(input.dateOfBirth);
    if (Number.isNaN(dt.getTime())) return null;
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    return partsToYmd(y, m, d);
  }

  return null;
}

// --------------------- Schemas ---------------------
export const verify18Schema = z
  .union([
    z.object({
      year: z.coerce.number().int().gte(1900).lte(3000),
      month: z.coerce.number().int().gte(1).lte(12),
      day: z.coerce.number().int().gte(1).lte(31),
    }),
    z.object({ dob: dobYyyyMmDd }),
    z.object({ dateOfBirth: z.string().min(4) }), // validated in superRefine via normalizeDob
    z.object({ dob: dobDdMmYyyy }),
  ])
  .superRefine((v, ctx) => {
    const ymd = normalizeDob(v);
    if (!ymd) {
      // ✅ no nested ternary; follow project rule
      let path: (string | number)[];
      if ('year' in v) {
        path = ['year'];
      } else if ('dob' in v) {
        path = ['dob'];
      } else {
        path = ['dateOfBirth'];
      }

      // ✅ use raw string code to avoid deprecation
      ctx.addIssue({
        code: 'custom',
        path,
        message: 'Invalid date of birth',
      });
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

