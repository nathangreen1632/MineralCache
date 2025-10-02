// Server/src/validation/product.schema.ts
import { z } from 'zod';

/** Common field shapes (no deprecated APIs) */
const id = z.coerce.number().int().positive();

// Helpers (v4-safe): remove .finite() — it's a no-op now
const to2dp = (v: number) => Math.round(v * 100) / 100;
const finite = (v: number) => Number.isFinite(v) || 'Must be a finite number';
const cm = z.coerce.number().refine(finite).min(0).max(9999).transform(to2dp);
const grams = z.coerce.number().min(0).max(999_999).transform(to2dp);
const carats = z.coerce.number().min(0).max(999_999).transform(to2dp);

const cents = z.coerce.number().int().min(0);
const nonEmpty = z.string().trim().min(1);

const fluorescenceMode = z.enum(['none', 'SW', 'LW', 'both']);
const conditionEnum = z.enum(['pristine', 'minor_damage', 'repaired', 'restored']);

const provenanceEntry = z.object({
  owner: z.string().min(1).max(200),
  yearStart: z.coerce.number().int().min(1000).max(9999).optional(),
  yearEnd: z.coerce.number().int().min(1000).max(9999).optional(),
  note: z.string().max(1000).optional(),
}).refine(
  (v) => !v.yearStart || !v.yearEnd || v.yearStart <= v.yearEnd,
  { message: 'yearStart must be ≤ yearEnd', path: ['yearEnd'] },
);

// ✅ Allow nulls for nullable DB columns
const fluorescence = z.object({
  mode: fluorescenceMode,
  colorNote: z.string().max(500).optional().nullable(),
  // Typical SW/LW bands ~254nm & ~365nm; keep flexible but bounded.
  wavelengthNm: z.array(z.coerce.number().int().min(200).max(450)).max(4).optional().nullable(),
});

/** Create payload (vendor) — unified schema */
export const createProductSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(5000).optional().nullable(),

  species: nonEmpty.max(140),
  locality: z.string().trim().max(200).optional().nullable(),
  synthetic: z.coerce.boolean().optional().default(false),

  // Dimensions (cm) + note
  lengthCm: cm.nullish(),   // null|undefined allowed; we coerce/round when present
  widthCm: cm.nullish(),
  heightCm: cm.nullish(),
  sizeNote: z.string().trim().max(500).optional().nullable(),

  // Weight
  weightG: grams.nullish(),
  weightCt: carats.nullish(),

  // Fluorescence (structured)
  fluorescence,

  // Condition
  condition: conditionEnum.nullish(),
  conditionNote: z.string().trim().max(1000).optional().nullable(),

  // Provenance
  provenanceNote: z.string().trim().max(2000).optional().nullable(),
  // [{ owner, yearStart?, yearEnd?, note? }]
  provenanceTrail: z.array(provenanceEntry).max(20).optional().nullable(),

  // Pricing (scheduled sale model)
  priceCents: cents,
  salePriceCents: cents.optional().nullable(),
  saleStartAt: z.coerce.date().optional().nullable(),
  saleEndAt: z.coerce.date().optional().nullable(),

  // Images (keep your current placeholder contract)
  images: z.array(z.string().trim().max(500)).max(6).optional(),
})
  .refine(
    (v) => !v.salePriceCents || v.salePriceCents < v.priceCents,
    { message: 'salePriceCents must be less than priceCents', path: ['salePriceCents'] },
  )
  .refine(
    (v) => !v.saleStartAt || !v.saleEndAt || v.saleStartAt <= v.saleEndAt,
    { message: 'saleStartAt must be ≤ saleEndAt', path: ['saleEndAt'] },
  );

/** Update payload (vendor) — all optional; must include at least one field */
export const updateProductSchema = createProductSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });

/** Archive = soft delete */
export const archiveProductSchema = z.object({ id });

/** Public list filters + sorting (supports new filters + keeps old min/max aliases) */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),

  vendorId: z.coerce.number().int().positive().optional(),
  vendorSlug: z.string().trim().max(140).optional(),
  species: z.string().trim().max(140).optional(),
  synthetic: z.coerce.boolean().optional(),

  // Effective on-sale state (based on scheduled sale window)
  onSale: z.coerce.boolean().optional(),

  // NEW: size range (apply to longest edge via GREATEST(length,width,height))
  sizeMinCm: cm.optional(),
  sizeMaxCm: cm.optional(),

  // NEW: structured filters
  fluorescence: z.string().trim().max(50).optional(), // single or comma list of SW,LW,both,none
  condition: z.string().trim().max(200).optional(),    // single or comma list of enum values

  // Sorting
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),

  // Effective price range (in cents) — prefer these
  priceMinCents: cents.optional(),
  priceMaxCents: cents.optional(),

  // Back-compat (deprecated): some callers may still send these
  minCents: cents.optional(),
  maxCents: cents.optional(),
});

/** Path param id */
export const productIdParamSchema = z.object({ id });
