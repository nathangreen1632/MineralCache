// Client/src/pages/products/ProductForm.tsx
import React, { useEffect, useMemo, useState, useId } from 'react';
import { z } from 'zod';
import type { ProductInput } from '../../api/products';

/** -------- Zod Schema matching new structured ProductInput -------- */
const FluorSchema = z.object({
  mode: z.enum(['none', 'SW', 'LW', 'both']),
  colorNote: z.string().max(240).optional().nullable(),
  // Optional; if you later expose this, parse as comma-separated numbers
  wavelengthNm: z.array(z.number().int().positive()).max(4).optional().nullable(),
});

const Schema = z
  .object({
    title: z.string().min(2, 'Required').max(160, 'Max 160 chars'),
    description: z.string().max(8000, 'Max 8000 chars').optional().nullable(),

    species: z.string().min(1, 'Required').max(120, 'Max 120 chars'),
    locality: z.string().max(240).optional().nullable(),
    synthetic: z.boolean().optional(),

    // Dimensions + weight (structured)
    lengthCm: z.number().nonnegative().optional().nullable(),
    widthCm: z.number().nonnegative().optional().nullable(),
    heightCm: z.number().nonnegative().optional().nullable(),
    sizeNote: z.string().max(120).optional().nullable(),

    weightG: z.number().nonnegative().optional().nullable(),
    weightCt: z.number().nonnegative().optional().nullable(),

    // Structured fluorescence
    fluorescence: FluorSchema,

    // Condition + provenance (flat notes for now)
    condition: z.string().max(240).optional().nullable(),
    conditionNote: z.string().max(240).optional().nullable(),
    provenanceNote: z.string().max(240).optional().nullable(),
    // provenanceTrail omitted from form (will send null/initial value)

    // Pricing (scheduled sale model)
    priceCents: z.number().int().min(1, 'Must be ≥ 1'),
    salePriceCents: z.number().int().min(0).nullable().optional(),
    // Use string ISO at the API boundary
    saleStartAt: z.string().optional().nullable(),
    saleEndAt: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    // Sale price must be less than priceCents (if provided)
    if (val.salePriceCents != null && val.salePriceCents >= val.priceCents) {
      ctx.addIssue({
        code: 'custom',
        path: ['salePriceCents'],
        message: 'Sale price must be less than regular price.',
      });
    }
    // If both dates present, enforce start ≤ end
    if (val.saleStartAt && val.saleEndAt) {
      const start = new Date(val.saleStartAt).getTime();
      const end = new Date(val.saleEndAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
        ctx.addIssue({
          code: 'custom',
          path: ['saleStartAt'],
          message: 'Sale start must be ≤ sale end.',
        });
      }
    }
  });

export type ProductFormValues = z.infer<typeof Schema>;

type Props = {
  mode: 'create' | 'edit';
  initial?: Partial<ProductInput>;
  onSubmit: (values: ProductInput, images: File[]) => Promise<void>;
  busy?: boolean;
  serverMessage?: string | null;
};

const DEFAULT_FLUOR = { mode: 'none', colorNote: null, wavelengthNm: null } as const;

export default function ProductForm({
                                      mode,
                                      initial,
                                      onSubmit,
                                      busy,
                                      serverMessage,
                                    }: Readonly<Props>): React.ReactElement {
  // ids to associate labels with inputs
  const ids = {
    title: useId(),
    description: useId(),
    species: useId(),
    locality: useId(),
    lengthCm: useId(),
    widthCm: useId(),
    heightCm: useId(),
    sizeNote: useId(),
    weightG: useId(),
    weightCt: useId(),
    fluorMode: useId(),
    fluorColor: useId(),
    condition: useId(),
    conditionNote: useId(),
    provenanceNote: useId(),
    priceCents: useId(),
    salePriceCents: useId(),
    saleStartAt: useId(),
    saleEndAt: useId(),
    photos: useId(),
  };

  // keep cents as numbers; keep text fields nullable
  const [values, setValues] = useState<ProductFormValues>(() => ({
    title: initial?.title ?? '',
    description: initial?.description ?? null,

    species: initial?.species ?? '',
    locality: initial?.locality ?? null,
    synthetic: Boolean(initial?.synthetic),

    lengthCm: initial?.lengthCm ?? null,
    widthCm: initial?.widthCm ?? null,
    heightCm: initial?.heightCm ?? null,
    sizeNote: initial?.sizeNote ?? null,

    weightG: initial?.weightG ?? null,
    weightCt: initial?.weightCt ?? null,

    fluorescence: initial?.fluorescence ?? DEFAULT_FLUOR,

    condition: initial?.condition ?? null,
    conditionNote: initial?.conditionNote ?? null,
    provenanceNote: initial?.provenanceNote ?? null,

    priceCents: Number.isFinite(initial?.priceCents) ? Number(initial?.priceCents) : 0,
    salePriceCents:
      initial?.salePriceCents == null ? null : Math.trunc(Number(initial.salePriceCents)),
    saleStartAt: initial?.saleStartAt ?? null,
    saleEndAt: initial?.saleEndAt ?? null,
  }));

  useEffect(() => {
    // when initial changes (edit page load), hydrate
    if (initial) {
      const next: ProductFormValues = {
        ...values,
        title: initial.title ?? values.title,
        description: initial.description ?? values.description,

        species: initial.species ?? values.species,
        locality: initial.locality ?? values.locality,
        synthetic: Boolean(initial.synthetic ?? values.synthetic),

        lengthCm: initial.lengthCm ?? values.lengthCm,
        widthCm: initial.widthCm ?? values.widthCm,
        heightCm: initial.heightCm ?? values.heightCm,
        sizeNote: initial.sizeNote ?? values.sizeNote,

        weightG: initial.weightG ?? values.weightG,
        weightCt: initial.weightCt ?? values.weightCt,

        fluorescence: initial.fluorescence ?? values.fluorescence ?? DEFAULT_FLUOR,

        condition: initial.condition ?? values.condition,
        conditionNote: initial.conditionNote ?? values.conditionNote,
        provenanceNote: initial.provenanceNote ?? values.provenanceNote,

        priceCents:
          Number.isFinite(initial.priceCents) && Number(initial.priceCents) > 0
            ? Number(initial.priceCents)
            : values.priceCents,
        salePriceCents:
          initial.salePriceCents == null ? null : Math.trunc(Number(initial.salePriceCents)),
        saleStartAt: initial.saleStartAt ?? values.saleStartAt,
        saleEndAt: initial.saleEndAt ?? values.saleEndAt,
      };
      setValues(next);
    }

  }, [initial]);

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [images, setImages] = useState<File[]>([]);

  const canSubmit = useMemo(() => {
    const parsed = Schema.safeParse(values);
    if (!parsed.success) return false;
    return images.length <= 4;

  }, [values, images.length]);

  function setField<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    const parsed = Schema.safeParse(next);
    if (parsed.success) {
      setErrs({});
    } else {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const p = String(issue.path[0] ?? '');
        if (!fe[p]) fe[p] = issue.message;
      }
      setErrs(fe);
    }
  }

  function setFluorField<K extends keyof ProductFormValues['fluorescence']>(
    key: K,
    value: ProductFormValues['fluorescence'][K]
  ) {
    const current = values.fluorescence || DEFAULT_FLUOR;
    setField('fluorescence', { ...current, [key]: value });
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    const next = files.slice(0, 4);
    setImages(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Schema.safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const p = String(issue.path[0] ?? '');
        if (!fe[p]) fe[p] = issue.message;
      }
      setErrs(fe);
      return;
    }

    // Normalize optional strings to null for server parity
    function normalize(s?: string | null) {
      if (s == null) return null;
      const t = s.trim();
      if (t === '') return null;
      return t;
    }

    const payload: ProductInput = {
      title: parsed.data.title.trim(),
      description: normalize(parsed.data.description ?? null),
      species: parsed.data.species.trim(),
      locality: normalize(parsed.data.locality ?? null),
      synthetic: Boolean(parsed.data.synthetic ?? false),

      lengthCm: parsed.data.lengthCm ?? null,
      widthCm: parsed.data.widthCm ?? null,
      heightCm: parsed.data.heightCm ?? null,
      sizeNote: normalize(parsed.data.sizeNote ?? null),

      weightG: parsed.data.weightG ?? null,
      weightCt: parsed.data.weightCt ?? null,

      fluorescence: {
        mode: parsed.data.fluorescence.mode,
        colorNote: normalize(parsed.data.fluorescence.colorNote ?? null),
        wavelengthNm: parsed.data.fluorescence.wavelengthNm ?? null,
      },

      condition: normalize(parsed.data.condition ?? null),
      conditionNote: normalize(parsed.data.conditionNote ?? null),
      provenanceNote: normalize(parsed.data.provenanceNote ?? null),
      provenanceTrail: null, // future: structured entries

      priceCents: Math.trunc(parsed.data.priceCents),

      salePriceCents:
        parsed.data.salePriceCents == null ? null : Math.trunc(parsed.data.salePriceCents),
      saleStartAt: normalize(parsed.data.saleStartAt ?? null),
      saleEndAt: normalize(parsed.data.saleEndAt ?? null),

      images: [], // not used by API submit; uploads handled separately
    };

    await onSubmit(payload, images);
  }

  function fieldCls(invalid?: boolean) {
    const base =
      'w-full rounded-lg border px-3 py-2 text-sm outline-none ring-0 bg-[var(--theme-textbox)]';
    if (invalid) return `${base} border-[var(--theme-error)]`;
    return `${base} border-[var(--theme-border)] focus:border-[var(--theme-focus)]`;
  }

  // submit label without nested ternaries
  let submitLabel = 'Create';
  if (mode === 'edit') submitLabel = 'Save';
  if (busy) submitLabel = mode === 'edit' ? 'Saving…' : 'Creating…';

  return (
    <form onSubmit={submit} className="space-y-5">
      {Boolean(serverMessage) && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            background: 'var(--theme-card-alt)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          {serverMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor={ids.title}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Title
          </label>
          <input
            id={ids.title}
            className={fieldCls(Boolean(errs.title))}
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            maxLength={160}
          />
          {errs.title && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.title}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={ids.description}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Description
          </label>
          <textarea
            id={ids.description}
            className={fieldCls(Boolean(errs.description))}
            value={values.description ?? ''}
            onChange={(e) => setField('description', e.target.value)}
            rows={5}
            maxLength={8000}
          />
          {errs.description && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.description}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={ids.species}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Species
          </label>
          <input
            id={ids.species}
            className={fieldCls(Boolean(errs.species))}
            value={values.species}
            onChange={(e) => setField('species', e.target.value)}
            maxLength={120}
          />
          {errs.species && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.species}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={ids.locality}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Locality
          </label>
          <input
            id={ids.locality}
            className={fieldCls(Boolean(errs.locality))}
            value={values.locality ?? ''}
            onChange={(e) => setField('locality', e.target.value)}
            maxLength={240}
          />
          {errs.locality && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.locality}
            </p>
          )}
        </div>

        {/* Dimensions */}
        <div>
          <label
            htmlFor={ids.lengthCm}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Length (cm)
          </label>
          <input
            id={ids.lengthCm}
            className={fieldCls(Boolean(errs.lengthCm))}
            type="number"
            step="0.01"
            value={values.lengthCm ?? ''}
            onChange={(e) =>
              setField('lengthCm', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>
        <div>
          <label
            htmlFor={ids.widthCm}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Width (cm)
          </label>
          <input
            id={ids.widthCm}
            className={fieldCls(Boolean(errs.widthCm))}
            type="number"
            step="0.01"
            value={values.widthCm ?? ''}
            onChange={(e) =>
              setField('widthCm', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>
        <div>
          <label
            htmlFor={ids.heightCm}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Height (cm)
          </label>
          <input
            id={ids.heightCm}
            className={fieldCls(Boolean(errs.heightCm))}
            type="number"
            step="0.01"
            value={values.heightCm ?? ''}
            onChange={(e) =>
              setField('heightCm', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={ids.sizeNote}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Size note
          </label>
          <input
            id={ids.sizeNote}
            className={fieldCls(Boolean(errs.sizeNote))}
            value={values.sizeNote ?? ''}
            onChange={(e) => setField('sizeNote', e.target.value)}
            maxLength={120}
          />
        </div>

        {/* Weights */}
        <div>
          <label
            htmlFor={ids.weightG}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Weight (g)
          </label>
          <input
            id={ids.weightG}
            className={fieldCls(Boolean(errs.weightG))}
            type="number"
            step="0.01"
            value={values.weightG ?? ''}
            onChange={(e) =>
              setField('weightG', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>
        <div>
          <label
            htmlFor={ids.weightCt}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Weight (ct)
          </label>
          <input
            id={ids.weightCt}
            className={fieldCls(Boolean(errs.weightCt))}
            type="number"
            step="0.01"
            value={values.weightCt ?? ''}
            onChange={(e) =>
              setField('weightCt', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>

        {/* Fluorescence */}
        <div>
          <label
            htmlFor={ids.fluorMode}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Fluorescence mode
          </label>
          <select
            id={ids.fluorMode}
            className={fieldCls(Boolean((errs as any)['fluorescence.mode']))}
            value={values.fluorescence?.mode ?? 'none'}
            onChange={(e) => setFluorField('mode', e.target.value as any)}
          >
            <option value="none">None</option>
            <option value="SW">SW</option>
            <option value="LW">LW</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={ids.fluorColor}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Fluorescence color note
          </label>
          <input
            id={ids.fluorColor}
            className={fieldCls(Boolean((errs as any)['fluorescence.colorNote']))}
            value={values.fluorescence?.colorNote ?? ''}
            onChange={(e) => setFluorField('colorNote', e.target.value || null)}
          />
        </div>

        {/* Pricing */}
        <div>
          <label
            htmlFor={ids.priceCents}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Price (¢)
          </label>
          <input
            id={ids.priceCents}
            inputMode="numeric"
            className={fieldCls(Boolean(errs.priceCents))}
            value={String(values.priceCents ?? '')}
            onChange={(e) => {
              const raw = e.target.value;
              const n = Math.trunc(Number(raw) || 0);
              setField('priceCents', n < 0 ? 0 : n);
            }}
          />
          {errs.priceCents && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.priceCents}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={ids.salePriceCents}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Sale price (¢) <span className="opacity-60">(optional)</span>
          </label>
          <input
            id={ids.salePriceCents}
            inputMode="numeric"
            className={fieldCls(Boolean(errs.salePriceCents))}
            value={values.salePriceCents == null ? '' : String(values.salePriceCents)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') setField('salePriceCents', null);
              else {
                const n = Math.trunc(Number(raw) || 0);
                setField('salePriceCents', n < 0 ? 0 : n);
              }
            }}
          />
          {errs.salePriceCents && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.salePriceCents}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={ids.saleStartAt}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Sale start (ISO) <span className="opacity-60">(optional)</span>
          </label>
          <input
            id={ids.saleStartAt}
            className={fieldCls(Boolean(errs.saleStartAt))}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            value={values.saleStartAt ?? ''}
            onChange={(e) => setField('saleStartAt', e.target.value || null)}
          />
          {errs.saleStartAt && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.saleStartAt}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={ids.saleEndAt}
            className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
          >
            Sale end (ISO) <span className="opacity-60">(optional)</span>
          </label>
          <input
            id={ids.saleEndAt}
            className={fieldCls(Boolean(errs.saleEndAt))}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            value={values.saleEndAt ?? ''}
            onChange={(e) => setField('saleEndAt', e.target.value || null)}
          />
          {errs.saleEndAt && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.saleEndAt}
            </p>
          )}
        </div>
      </div>

      {/* Photos (≤4) */}
      <div>
        <label
          htmlFor={ids.photos}
          className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
        >
          Photos (up to 4)
        </label>
        <input id={ids.photos} type="file" accept="image/*" multiple onChange={onPickFiles} />
        <p className="mt-1 text-xs" style={{ color: 'var(--theme-link)' }}>
          We’ll create 320/800/1600 px derivatives on upload.
        </p>
        {images.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {images.map((f) => (
              <li
                key={f.name}
                className="rounded-lg border p-2"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  className="h-24 w-full rounded object-cover"
                  onLoad={(ev) => URL.revokeObjectURL((ev.target as HTMLImageElement).src)}
                />
                <div className="mt-1 truncate text-xs" style={{ color: 'var(--theme-text)' }}>
                  {f.name}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--theme-link)' }}>
                  {(f.size / 1024).toFixed(0)} KB
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={Boolean(busy) || !canSubmit}
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
        >
          {submitLabel}
        </button>
        <a
          href="/vendor/dashboard"
          className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset"
          style={{
            background: 'var(--theme-surface)',
            color: 'var(--theme-text)',
            borderColor: 'var(--theme-border)',
          }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
