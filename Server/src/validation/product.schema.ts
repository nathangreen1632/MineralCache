import { z } from 'zod';

const id = z.coerce.number().int().positive();
const to2dp = (v: number) => Math.round(v * 100) / 100;
const finite = (v: number) => Number.isFinite(v) || 'Must be a finite number';
const cm = z.coerce.number().refine(finite).min(0).max(9999).transform(to2dp);
const grams = z.coerce.number().min(0).max(999_999).transform(to2dp);
const carats = z.coerce.number().min(0).max(999_999).transform(to2dp);
const cents = z.coerce.number().int().min(0);
const nonEmpty = z.string().trim().min(1);
const fluorescenceMode = z.enum(['none', 'SW', 'LW', 'both']);
const conditionEnum = z.enum(['pristine', 'minor_damage', 'repaired', 'restored']);

const provenanceEntry = z
  .object({
    owner: z.string().min(1).max(200),
    yearStart: z.coerce.number().int().min(1000).max(9999).optional(),
    yearEnd: z.coerce.number().int().min(1000).max(9999).optional(),
    note: z.string().max(1000).optional(),
  })
  .refine((v) => !v.yearStart || !v.yearEnd || v.yearStart <= v.yearEnd, {
    message: 'yearStart must be ≤ yearEnd',
    path: ['yearEnd'],
  });

const fluorescence = z.object({
  mode: fluorescenceMode,
  colorNote: z.string().max(500).optional().nullable(),
  wavelengthNm: z.array(z.coerce.number().int().min(200).max(450)).max(4).optional().nullable(),
});

export const createProductSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(5000).optional().nullable(),
    species: nonEmpty.max(140),
    locality: z.string().trim().max(200).optional().nullable(),
    synthetic: z.coerce.boolean().optional().default(false),
    radioactive: z.coerce.boolean().optional().default(false),
    lengthCm: cm.nullish(),
    widthCm: cm.nullish(),
    heightCm: cm.nullish(),
    sizeNote: z.string().trim().max(500).optional().nullable(),
    weightG: grams.nullish(),
    weightCt: carats.nullish(),
    fluorescence,
    condition: conditionEnum.nullish(),
    conditionNote: z.string().trim().max(1000).optional().nullable(),
    provenanceNote: z.string().trim().max(2000).optional().nullable(),
    provenanceTrail: z.array(provenanceEntry).max(20).optional().nullable(),
    priceCents: cents,
    salePriceCents: cents.optional().nullable(),
    saleStartAt: z.coerce.date().optional().nullable(),
    saleEndAt: z.coerce.date().optional().nullable(),
    categoryId: id,
    images: z.array(z.string().trim().max(500)).max(6).optional(),
  })
  .refine((v) => !v.salePriceCents || v.salePriceCents < v.priceCents, {
    message: 'salePriceCents must be less than priceCents',
    path: ['salePriceCents'],
  })
  .refine((v) => !v.saleStartAt || !v.saleEndAt || v.saleStartAt <= v.saleEndAt, {
    message: 'saleStartAt must be ≤ saleEndAt',
    path: ['saleEndAt'],
  });

export const updateProductSchema = createProductSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });

export const archiveProductSchema = z.object({ id });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  q: z.string().trim().min(1).max(120).optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  vendorSlug: z.string().trim().max(140).optional(),
  species: z.string().trim().max(140).optional(),
  synthetic: z.coerce.boolean().optional(),
  radioactive: z.coerce.boolean().optional(),
  onSale: z.coerce.boolean().optional(),
  sizeMinCm: cm.optional(),
  sizeMaxCm: cm.optional(),
  fluorescence: z.string().trim().max(50).optional(),
  condition: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).max(140).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc']).optional().default('newest'),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  priceMinCents: cents.optional(),
  priceMaxCents: cents.optional(),
  minCents: cents.optional(),
  maxCents: cents.optional(),
});

export const productIdParamSchema = z.object({ id });
