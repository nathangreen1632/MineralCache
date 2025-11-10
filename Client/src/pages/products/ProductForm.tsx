// Client/src/pages/products/ProductForm.tsx
import React, { useEffect, useMemo, useState, useId, useRef } from 'react';
import { z } from 'zod';
import type { ProductInput } from '../../api/products';
import { listCategories, type PublicCategory } from '../../api/public';
import { ChevronDown } from 'lucide-react';

const CONDITION_OPTIONS = [
  { value: 'pristine', label: 'Pristine' },
  { value: 'minor_damage', label: 'Minor Damage' },
  { value: 'repaired', label: 'Repaired' },
  { value: 'restored', label: 'Restored' },
];
const VALID_CONDITIONS = new Set(CONDITION_OPTIONS.map(o => o.value));

const FluorSchema = z.object({
  mode: z.enum(['none', 'SW', 'LW', 'both']).optional().nullable(),
  colorNote: z.string().max(240).optional().nullable(),
  wavelengthNm: z.array(z.number().int().positive()).max(4).optional().nullable(),
});

const Schema = z
  .object({
    title: z.string().max(160).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    species: z.string().max(120).optional().nullable(),
    locality: z.string().max(240).optional().nullable(),
    synthetic: z.boolean().optional().nullable(),
    lengthCm: z.number().nonnegative().optional().nullable(),
    widthCm: z.number().nonnegative().optional().nullable(),
    heightCm: z.number().nonnegative().optional().nullable(),
    sizeNote: z.string().max(120).optional().nullable(),
    weightG: z.number().nonnegative().optional().nullable(),
    weightCt: z.number().nonnegative().optional().nullable(),
    fluorescence: FluorSchema.optional().nullable(),
    condition: z.union([z.literal(''), z.enum(['pristine', 'minor_damage', 'repaired', 'restored'])]),
    conditionNote: z.string().max(240).optional().nullable(),
    provenanceNote: z.string().max(240).optional().nullable(),
    priceCents: z.number().int().nonnegative().optional().nullable(),
    salePriceCents: z.number().int().nonnegative().optional().nullable(),
    saleStartAt: z.string().optional().nullable(),
    saleEndAt: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (
      val.priceCents != null &&
      val.salePriceCents != null &&
      Number.isFinite(val.priceCents) &&
      Number.isFinite(val.salePriceCents) &&
      val.salePriceCents >= val.priceCents
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['salePriceCents'],
        message: 'Sale price must be less than regular price when both are provided.',
      });
    }
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
    categoryId: useId(),
    synthetic: useId(),
  };

  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>(() => {
    const cid = (initial as any)?.categoryId;
    return typeof cid === 'number' ? String(cid) : '';
  });

  useEffect(() => {
    async function loadCats() {
      try {
        const rows = await listCategories();
        const sorted = (rows ?? [])
          .filter((c) => c.active)
          .sort((a, b) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0));
        setCategories(sorted);
        const cid = (initial as any)?.categoryId;
        if (!categoryId && typeof cid === 'number') setCategoryId(String(cid));
      } catch {
        setCategories([]);
      }
    }
    void loadCats();
  }, [initial]);

  const [values, setValues] = useState<ProductFormValues>(() => ({
    title: initial?.title ?? null,
    description: initial?.description ?? null,
    species: initial?.species ?? null,
    locality: initial?.locality ?? null,
    synthetic: (initial?.synthetic as boolean | null | undefined) ?? false,
    lengthCm: initial?.lengthCm ?? null,
    widthCm: initial?.widthCm ?? null,
    heightCm: initial?.heightCm ?? null,
    sizeNote: initial?.sizeNote ?? null,
    weightG: initial?.weightG ?? null,
    weightCt: initial?.weightCt ?? null,
    fluorescence: (initial?.fluorescence as ProductFormValues['fluorescence']) ?? DEFAULT_FLUOR,
    condition: VALID_CONDITIONS.has((initial?.condition as string) ?? '') ? (initial?.condition as any) : '',
    conditionNote: initial?.conditionNote ?? null,
    provenanceNote: initial?.provenanceNote ?? null,
    priceCents: initial?.priceCents == null ? null : Math.trunc(Number(initial.priceCents)),
    salePriceCents:
      initial?.salePriceCents == null ? null : Math.trunc(Number(initial.salePriceCents)),
    saleStartAt: initial?.saleStartAt ?? null,
    saleEndAt: initial?.saleEndAt ?? null,
  }));

  useEffect(() => {
    if (!initial) return;
    setValues((prev) => ({
      ...prev,
      title: initial.title ?? prev.title,
      description: initial.description ?? prev.description,
      species: initial.species ?? prev.species,
      locality: initial.locality ?? prev.locality,
      synthetic: (initial.synthetic as boolean | null | undefined) ?? prev.synthetic ?? false,
      lengthCm: initial.lengthCm ?? prev.lengthCm,
      widthCm: initial.widthCm ?? prev.widthCm,
      heightCm: initial.heightCm ?? prev.heightCm,
      sizeNote: initial.sizeNote ?? prev.sizeNote,
      weightG: initial.weightG ?? prev.weightG,
      weightCt: initial.weightCt ?? prev.weightCt,
      fluorescence:
        (initial.fluorescence as ProductFormValues['fluorescence']) ??
        prev.fluorescence ??
        DEFAULT_FLUOR,
      condition: VALID_CONDITIONS.has((initial?.condition as string) ?? '') ? (initial?.condition as any) : prev.condition ?? '',
      conditionNote: initial.conditionNote ?? prev.conditionNote,
      provenanceNote: initial.provenanceNote ?? prev.provenanceNote,
      priceCents:
        initial.priceCents == null ? prev.priceCents : Math.trunc(Number(initial.priceCents)),
      salePriceCents:
        initial.salePriceCents == null
          ? prev.salePriceCents
          : Math.trunc(Number(initial.salePriceCents)),
      saleStartAt: initial.saleStartAt ?? prev.saleStartAt,
      saleEndAt: initial.saleEndAt ?? prev.saleEndAt,
    }));
    const cid = (initial as any)?.categoryId;
    if (typeof cid === 'number') setCategoryId(String(cid));
  }, [initial]);

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [images, setImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [touched, setTouched] = useState<{ species: boolean; locality: boolean; price: boolean; condition: boolean }>(
    { species: false, locality: false, price: false, condition: false }
  );
  const speciesMissing = (values.species ?? '').trim() === '';
  const localityMissing = (values.locality ?? '').trim() === '';
  const priceMissing = !(values.priceCents != null && Number(values.priceCents) > 0);
  const conditionMissing = (values.condition as string) === '';

  const canSubmit = useMemo(
    () =>
      !busy &&
      images.length <= 6 &&
      categoryId !== '' &&
      !speciesMissing &&
      !localityMissing &&
      !priceMissing &&
      !conditionMissing,
    [busy, images.length, categoryId, speciesMissing, localityMissing, priceMissing, conditionMissing]
  );

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

  type Fluor = NonNullable<ProductFormValues['fluorescence']>;
  function setFluorField<K extends keyof Fluor>(key: K, value: Fluor[K]) {
    const current = (values.fluorescence ?? DEFAULT_FLUOR) as Fluor;
    setField('fluorescence', { ...current, [key]: value } as unknown as ProductFormValues['fluorescence']);
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    const next = files.slice(0, 6);
    setImages(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (speciesMissing || localityMissing || priceMissing || conditionMissing) {
      setTouched({ species: true, locality: true, price: true, condition: true });
      return;
    }
    if (!categoryId) return;

    const normalize = (s?: string | null) => {
      if (s == null) return null;
      const t = s.trim();
      return t === '' ? null : t;
    };

    const base: ProductInput = {
      title: normalize(values.title ?? null) ?? '',
      description: normalize(values.description ?? null),
      species: normalize(values.species ?? null) ?? '',
      locality: normalize(values.locality ?? null),
      synthetic: Boolean(values.synthetic ?? false),
      lengthCm: values.lengthCm ?? null,
      widthCm: values.widthCm ?? null,
      heightCm: values.heightCm ?? null,
      sizeNote: normalize(values.sizeNote ?? null),
      weightG: values.weightG ?? null,
      weightCt: values.weightCt ?? null,
      fluorescence: {
        mode: values.fluorescence?.mode ?? 'none',
        colorNote: normalize(values.fluorescence?.colorNote ?? null),
        wavelengthNm: values.fluorescence?.wavelengthNm ?? null,
      },
      condition: normalize(values.condition as string) ?? '',
      conditionNote: normalize(values.conditionNote ?? null),
      provenanceNote: normalize(values.provenanceNote ?? null),
      provenanceTrail: null,
      priceCents:
        values.priceCents == null || Number.isNaN(values.priceCents)
          ? 0
          : Math.trunc(Number(values.priceCents)),
      salePriceCents:
        values.salePriceCents == null || Number.isNaN(values.salePriceCents)
          ? null
          : Math.trunc(Number(values.salePriceCents)),
      saleStartAt: normalize(values.saleStartAt ?? null),
      saleEndAt: normalize(values.saleEndAt ?? null),
      images: [],
    };

    const payload = { ...base, categoryId: Number(categoryId) } as ProductInput;
    await onSubmit(payload, images);
  }

  function fieldCls(invalid?: boolean) {
    const base =
      'w-full rounded-lg border px-3 py-2 text-sm outline-none ring-0 bg-[var(--theme-textbox)]';
    if (invalid) return `${base} border-[var(--theme-error)]`;
    return `${base} border-[var(--theme-border)] focus:border-[var(--theme-focus)]`;
  }

  function submitLabel(): string {
    if (busy) return mode === 'edit' ? 'Saving…' : 'Creating…';
    return mode === 'edit' ? 'Save' : 'Create';
  }

  function dollarsInputToCents(raw: string): number | null {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }
  function centsToDollarsString(c: number | null | undefined): string {
    if (c == null || Number.isNaN(c)) return '';
    const s = (c / 100).toFixed(2);
    return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

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

      <div className="rounded-2xl border bg-[var(--theme-category)] border-[var(--theme-border)] p-4">
        <label htmlFor={ids.categoryId} className="block text-sm font-semibold mb-1">
          Category <span className="text-[var(--theme-error)]" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <select
            id={ids.categoryId}
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 pr-10"
            aria-describedby="categoryHelp"
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
            aria-hidden
          />
        </div>
        <p id="categoryHelp" className="mt-1 text-xs opacity-80">
          Choose the single category this product belongs to.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor={ids.title} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Title <span className="text-[var(--theme-error)]" aria-hidden="true">*</span></label>
          <input
            id={ids.title}
            required
            className={fieldCls(Boolean(errs.title))}
            value={values.title ?? ''}
            onChange={(e) => setField('title', e.target.value)}
            maxLength={160}
          />
          {errs.title && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.title}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor={ids.description} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Description</label>
          <textarea
            id={ids.description}
            className={fieldCls(Boolean(errs.description))}
            value={values.description ?? ''}
            onChange={(e) => setField('description', e.target.value)}
            rows={5}
            maxLength={8000}
          />
          {errs.description && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.description}</p>}
        </div>

        <div>
          <label htmlFor={ids.species} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
            Species <span className="text-[var(--theme-error)]" aria-hidden="true">*</span>
          </label>
          <input
            id={ids.species}
            required
            aria-required="true"
            aria-invalid={touched.species && speciesMissing}
            className={fieldCls(Boolean(errs.species) || (touched.species && speciesMissing))}
            value={values.species ?? ''}
            onChange={(e) => setField('species', e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, species: true }))}
            maxLength={120}
            placeholder="Required"
          />
          {errs.species && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.species}</p>}
          {!errs.species && touched.species && speciesMissing && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>Species is required</p>
          )}
        </div>

        <div>
          <label htmlFor={ids.locality} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
            Locality <span className="text-[var(--theme-error)]" aria-hidden="true">*</span>
          </label>
          <input
            id={ids.locality}
            required
            aria-required="true"
            aria-invalid={touched.locality && localityMissing}
            className={fieldCls(Boolean(errs.locality) || (touched.locality && localityMissing))}
            value={values.locality ?? ''}
            onChange={(e) => setField('locality', e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, locality: true }))}
            maxLength={240}
            placeholder="Required"
          />
          {errs.locality && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.locality}</p>}
          {!errs.locality && touched.locality && localityMissing && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>Locality is required</p>
          )}
        </div>

        <div>
          <label htmlFor={ids.lengthCm} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Length (cm)</label>
          <input
            id={ids.lengthCm}
            className={fieldCls(Boolean(errs.lengthCm))}
            type="number"
            step="0.01"
            value={values.lengthCm ?? ''}
            onChange={(e) => setField('lengthCm', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor={ids.widthCm} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Width (cm)</label>
          <input
            id={ids.widthCm}
            className={fieldCls(Boolean(errs.widthCm))}
            type="number"
            step="0.01"
            value={values.widthCm ?? ''}
            onChange={(e) => setField('widthCm', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor={ids.heightCm} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Height (cm)</label>
          <input
            id={ids.heightCm}
            className={fieldCls(Boolean(errs.heightCm))}
            type="number"
            step="0.01"
            value={values.heightCm ?? ''}
            onChange={(e) => setField('heightCm', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor={ids.sizeNote} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Size note</label>
          <input
            id={ids.sizeNote}
            className={fieldCls(Boolean(errs.sizeNote))}
            value={values.sizeNote ?? ''}
            onChange={(e) => setField('sizeNote', e.target.value)}
            maxLength={120}
          />
          {errs.sizeNote && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.sizeNote}</p>}
        </div>

        <div>
          <label htmlFor={ids.weightG} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Weight (g)</label>
          <input
            id={ids.weightG}
            className={fieldCls(Boolean(errs.weightG))}
            type="number"
            step="0.01"
            value={values.weightG ?? ''}
            onChange={(e) => setField('weightG', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor={ids.weightCt} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Weight (ct)</label>
          <input
            id={ids.weightCt}
            className={fieldCls(Boolean(errs.weightCt))}
            type="number"
            step="0.01"
            value={values.weightCt ?? ''}
            onChange={(e) => setField('weightCt', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>

        <div>
          <label htmlFor={ids.fluorMode} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Fluorescence mode</label>
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
          <label htmlFor={ids.fluorColor} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Fluorescence color note</label>
          <input
            id={ids.fluorColor}
            className={fieldCls(Boolean((errs as any)['fluorescence.colorNote']))}
            value={values.fluorescence?.colorNote ?? ''}
            onChange={(e) => setFluorField('colorNote', e.target.value || null)}
          />
        </div>

        <div>
          <label htmlFor={ids.synthetic} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Synthetic <span className="text-[var(--theme-error)]" aria-hidden="true">*</span></label>
          <select
            id={ids.synthetic}
            required
            className={fieldCls(false)}
            value={values.synthetic ? 'yes' : 'no'}
            onChange={(e) => setField('synthetic', e.target.value === 'yes')}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div>
          <label htmlFor={ids.condition} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
            Condition <span className="text-[var(--theme-error)]" aria-hidden="true">*</span>
          </label>
          <select
            id={ids.condition}
            required
            aria-required="true"
            aria-invalid={touched.condition && conditionMissing}
            className={fieldCls((touched.condition && conditionMissing) || Boolean(errs.condition))}
            value={values.condition as string}
            onChange={(e) => setField('condition', e.target.value as any)}
            onBlur={() => setTouched((t) => ({ ...t, condition: true }))}
          >
            <option value="">Select a condition…</option>
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errs.condition && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.condition}</p>}
          {!errs.condition && touched.condition && conditionMissing && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>Condition is required</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor={ids.provenanceNote} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Provenance</label>
          <input
            id={ids.provenanceNote}
            className={fieldCls(Boolean(errs.provenanceNote))}
            value={values.provenanceNote ?? ''}
            onChange={(e) => setField('provenanceNote', e.target.value)}
            maxLength={240}
            placeholder="Optional provenance details"
          />
          {errs.provenanceNote && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.provenanceNote}</p>}
        </div>

        <div>
          <label htmlFor={ids.priceCents} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
            Price (USD) <span className="text-[var(--theme-error)]" aria-hidden="true">*</span>
          </label>
          <input
            id={ids.priceCents}
            required
            aria-required="true"
            aria-invalid={touched.price && priceMissing}
            inputMode="decimal"
            step="0.01"
            className={fieldCls(Boolean(errs.priceCents) || (touched.price && priceMissing))}
            value={centsToDollarsString(values.priceCents ?? null)}
            onChange={(e) => setField('priceCents', dollarsInputToCents(e.target.value))}
            onBlur={() => setTouched((t) => ({ ...t, price: true }))}
            placeholder="e.g. 65"
          />
          {errs.priceCents && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.priceCents}</p>}
          {!errs.priceCents && touched.price && priceMissing && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>Price is required</p>
          )}
        </div>

        <div>
          <label htmlFor={ids.salePriceCents} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
            Sale price (USD) <span className="opacity-60">(optional)</span>
          </label>
          <input
            id={ids.salePriceCents}
            inputMode="decimal"
            step="0.01"
            className={fieldCls(Boolean(errs.salePriceCents))}
            value={centsToDollarsString(values.salePriceCents ?? null)}
            onChange={(e) => setField('salePriceCents', dollarsInputToCents(e.target.value))}
            placeholder="e.g. 59.99"
          />
          {errs.salePriceCents && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.salePriceCents}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={ids.photos} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Photos (up to 6)</label>
        <input
          ref={fileInputRef}
          id={ids.photos}
          type="file"
          accept="image/*"
          multiple
          onChange={onPickFiles}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
        >
          Choose photos
        </button>
        <span className="ml-3 text-xs text-[var(--theme-link)]">{images.length} selected (max 6)</span>
        <p className="mt-1 text-xs" style={{ color: 'var(--theme-link)' }}>We’ll create 320/800/1600 px derivatives on upload.</p>
        {images.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {images.map((f) => (
              <li key={f.name} className="rounded-lg border p-2" style={{ borderColor: 'var(--theme-border)' }}>
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  className="h-44 w-full rounded object-cover"
                  onLoad={(ev) => URL.revokeObjectURL((ev.target as HTMLImageElement).src)}
                />
                <div className="mt-1 truncate text-xs text-[var(--theme-text)]">{f.name}</div>
                <div className="text-[10px] text-[var(--theme-link)]">{(f.size / 1024).toFixed(0)} KB</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
        >
          {submitLabel()}
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
