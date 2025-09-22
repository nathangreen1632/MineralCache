// Client/src/pages/products/ProductForm.tsx
import React, { useEffect, useMemo, useState, useId } from 'react';
import { z } from 'zod';
import type { ProductInput } from '../../api/products';

const Schema = z
  .object({
    title: z.string().min(2, 'Required').max(160, 'Max 160 chars'),
    description: z.string().max(8000, 'Max 8000 chars').optional().nullable(),
    species: z.string().min(1, 'Required').max(120, 'Max 120 chars'),
    locality: z.string().max(240).optional().nullable(),
    size: z.string().max(120).optional().nullable(),
    weight: z.string().max(120).optional().nullable(),
    fluorescence: z.string().max(240).optional().nullable(),
    condition: z.string().max(240).optional().nullable(),
    provenance: z.string().max(240).optional().nullable(),
    synthetic: z.boolean().optional(),
    onSale: z.boolean().optional(),
    priceCents: z.number().int().min(1, 'Must be ≥ 1'),
    compareAtCents: z.number().int().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.onSale && val.compareAtCents != null && val.compareAtCents < val.priceCents) {
      ctx.addIssue({
        code: 'custom', // ✅ use raw string literal (no deprecated ZodIssueCode)
        path: ['compareAtCents'],
        message: 'compareAtCents must be ≥ priceCents when onSale is enabled.',
      });
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
    size: useId(),
    weight: useId(),
    fluorescence: useId(),
    condition: useId(),
    provenance: useId(),
    synthetic: useId(),
    onSale: useId(),
    priceCents: useId(),
    compareAtCents: useId(),
    photos: useId(),
  };

  // keep cents as strings in inputs to avoid jumping
  const [values, setValues] = useState<ProductFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    species: initial?.species ?? '',
    locality: initial?.locality ?? '',
    size: initial?.size ?? '',
    weight: initial?.weight ?? '',
    fluorescence: initial?.fluorescence ?? '',
    condition: initial?.condition ?? '',
    provenance: initial?.provenance ?? '',
    synthetic: Boolean(initial?.synthetic ?? false),
    onSale: Boolean(initial?.onSale ?? false),
    priceCents: Number.isFinite(initial?.priceCents) ? Number(initial?.priceCents) : 0,
    compareAtCents:
      initial?.compareAtCents == null ? null : Number.parseInt(String(initial.compareAtCents), 10),
  });

  useEffect(() => {
    // when initial changes (edit page load), hydrate
    if (initial) {
      setValues((v) => ({
        ...v,
        title: initial.title ?? v.title,
        description: initial.description ?? v.description,
        species: initial.species ?? v.species,
        locality: initial.locality ?? v.locality,
        size: initial.size ?? v.size,
        weight: initial.weight ?? v.weight,
        fluorescence: initial.fluorescence ?? v.fluorescence,
        condition: initial.condition ?? v.condition,
        provenance: initial.provenance ?? v.provenance,
        synthetic: Boolean(initial.synthetic ?? v.synthetic),
        onSale: Boolean(initial.onSale ?? v.onSale),
        priceCents:
          Number.isFinite(initial.priceCents) && initial.priceCents! > 0
            ? Number(initial.priceCents)
            : v.priceCents,
        compareAtCents:
          initial.compareAtCents == null ? null : Number.parseInt(String(initial.compareAtCents), 10),
      }));
    }
  }, [initial]);

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [images, setImages] = useState<File[]>([]);

  const canSubmit = useMemo(() => {
    const parsed = Schema.safeParse(values);
    return parsed.success && images.length <= 4;
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
    const normalize = (s?: string | null) => (s != null && s.trim() === '' ? null : s ?? null);
    const payload: ProductInput = {
      title: parsed.data.title.trim(),
      description: normalize(parsed.data.description ?? null),
      species: parsed.data.species.trim(),
      locality: normalize(parsed.data.locality ?? null),
      size: normalize(parsed.data.size ?? null),
      weight: normalize(parsed.data.weight ?? null),
      fluorescence: normalize(parsed.data.fluorescence ?? null),
      condition: normalize(parsed.data.condition ?? null),
      provenance: normalize(parsed.data.provenance ?? null),
      synthetic: Boolean(parsed.data.synthetic ?? false),
      onSale: Boolean(parsed.data.onSale ?? false),
      priceCents: Math.trunc(parsed.data.priceCents),
      compareAtCents:
        parsed.data.compareAtCents == null ? null : Math.trunc(parsed.data.compareAtCents),
    };
    await onSubmit(payload, images);
  }

  function fieldCls(invalid?: boolean) {
    const base =
      'w-full rounded-lg border px-3 py-2 text-sm outline-none ring-0 bg-[var(--theme-textbox)]';
    return invalid
      ? `${base} border-[var(--theme-error)]`
      : `${base} border-[var(--theme-border)] focus:border-[var(--theme-focus)]`;
  }

  // submit label without any ternaries
  let submitLabel: string;

  if (busy) {
    if (mode === 'create') {
      submitLabel = 'Creating…';
    } else {
      submitLabel = 'Saving…';
    }
  } else if (mode === 'create') {
    submitLabel = 'Create';
  } else {
    submitLabel = 'Save';
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {serverMessage && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--theme-card-alt)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
        >
          {serverMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor={ids.title} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Title</label>
          <input
            id={ids.title}
            className={fieldCls(Boolean(errs.title))}
            value={values.title}
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
          <label htmlFor={ids.species} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Species</label>
          <input
            id={ids.species}
            className={fieldCls(Boolean(errs.species))}
            value={values.species}
            onChange={(e) => setField('species', e.target.value)}
            maxLength={120}
          />
          {errs.species && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.species}</p>}
        </div>

        <div>
          <label htmlFor={ids.locality} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Locality</label>
          <input
            id={ids.locality}
            className={fieldCls(Boolean(errs.locality))}
            value={values.locality ?? ''}
            onChange={(e) => setField('locality', e.target.value)}
            maxLength={240}
          />
          {errs.locality && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.locality}</p>}
        </div>

        <div>
          <label htmlFor={ids.size} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Size</label>
          <input
            id={ids.size}
            className={fieldCls(Boolean(errs.size))}
            value={values.size ?? ''}
            onChange={(e) => setField('size', e.target.value)}
            maxLength={120}
          />
        </div>

        <div>
          <label htmlFor={ids.weight} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Weight</label>
          <input
            id={ids.weight}
            className={fieldCls(Boolean(errs.weight))}
            value={values.weight ?? ''}
            onChange={(e) => setField('weight', e.target.value)}
            maxLength={120}
          />
        </div>

        <div>
          <label htmlFor={ids.fluorescence} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Fluorescence</label>
          <input
            id={ids.fluorescence}
            className={fieldCls(Boolean(errs.fluorescence))}
            value={values.fluorescence ?? ''}
            onChange={(e) => setField('fluorescence', e.target.value)}
            maxLength={240}
          />
        </div>

        <div>
          <label htmlFor={ids.condition} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Condition</label>
          <input
            id={ids.condition}
            className={fieldCls(Boolean(errs.condition))}
            value={values.condition ?? ''}
            onChange={(e) => setField('condition', e.target.value)}
            maxLength={240}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor={ids.provenance} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Provenance</label>
          <input
            id={ids.provenance}
            className={fieldCls(Boolean(errs.provenance))}
            value={values.provenance ?? ''}
            onChange={(e) => setField('provenance', e.target.value)}
            maxLength={240}
          />
        </div>

        <div className="flex items-center gap-6 md:col-span-2">
          <label htmlFor={ids.synthetic} className="inline-flex items-center gap-2 text-sm">
            <input
              id={ids.synthetic}
              type="checkbox"
              checked={Boolean(values.synthetic)}
              onChange={(e) => setField('synthetic', e.target.checked)}
            />
            <span>Synthetic</span>
          </label>
          <label htmlFor={ids.onSale} className="inline-flex items-center gap-2 text-sm">
            <input
              id={ids.onSale}
              type="checkbox"
              checked={Boolean(values.onSale)}
              onChange={(e) => setField('onSale', e.target.checked)}
            />
            <span>On sale</span>
          </label>
        </div>

        <div>
          <label htmlFor={ids.priceCents} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">Price (¢)</label>
          <input
            id={ids.priceCents}
            inputMode="numeric"
            className={fieldCls(Boolean(errs.priceCents))}
            value={String(values.priceCents ?? '')}
            onChange={(e) =>
              setField('priceCents', Number.isFinite(+e.target.value) ? Math.trunc(+e.target.value) : 0)
            }
          />
          {errs.priceCents && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{errs.priceCents}</p>
          )}
        </div>

        <div>
          <label htmlFor={ids.compareAtCents} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
            Compare At (¢) {!values.onSale && <span className="opacity-60">(optional)</span>}
          </label>
          <input
            id={ids.compareAtCents}
            inputMode="numeric"
            className={fieldCls(Boolean(errs.compareAtCents))}
            value={values.compareAtCents == null ? '' : String(values.compareAtCents)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setField('compareAtCents', raw === '' ? null : Math.trunc(+raw));
            }}
          />
          {errs.compareAtCents && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
              {errs.compareAtCents}
            </p>
          )}
        </div>
      </div>

      {/* Photos (≤4) */}
      <div>
        <label htmlFor={ids.photos} className="mb-1 block text-sm font-semibold text-[var(--theme-text)]">
          Photos (up to 4)
        </label>
        <input id={ids.photos} type="file" accept="image/*" multiple onChange={onPickFiles} />
        <p className="mt-1 text-xs" style={{ color: 'var(--theme-link)' }}>
          We’ll create 320/800/1600 px derivatives on upload.
        </p>
        {images.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {images.map((f) => (
              <li key={f.name} className="rounded-lg border p-2" style={{ borderColor: 'var(--theme-border)' }}>
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
          disabled={busy || !canSubmit}
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
