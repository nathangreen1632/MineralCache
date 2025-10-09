// Client/src/pages/products/ProductList.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { listProducts, type ListQuery, type Product } from '../../api/products';
import { searchProducts } from '../../api/search';
import { ChevronDown } from 'lucide-react'; // ⬅️ mobile collapse icon

// Allow an optional runtime-injected API base (e.g., set on window at boot)
declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

/** --- CONFIG: where the API is serving /uploads from (prod = same origin) --- */
const API_BASE =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined) ??
  (typeof window !== 'undefined' ? window.__API_BASE__ : undefined) ??
  '';

/** Join base + path without using regex (no S5852 risk). */
function trimTrailingSlashes(s: string) {
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}
function trimLeadingSlashes(s: string) {
  let i = 0;
  while (i < s.length && s[i] === '/') i++;
  return s.slice(i);
}
function joinUrl(base: string, path: string) {
  if (!base) return path || '';
  const b = trimTrailingSlashes(base);
  const p = trimLeadingSlashes(path || '');
  return p ? `${b}/${p}` : b;
}

function centsToUsd(cents?: number | null): string {
  const n = typeof cents === 'number' ? Math.max(0, Math.trunc(cents)) : 0;
  return `$${(n / 100).toFixed(2)}`;
}

function isSaleActive(p: Product, now = new Date()): boolean {
  if ((p as any).salePriceCents == null) return false;
  const startOk = !(p as any).saleStartAt || new Date((p as any).saleStartAt) <= now;
  const endOk = !(p as any).saleEndAt || now <= new Date((p as any).saleEndAt);
  return startOk && endOk;
}

function effectivePriceCents(p: Product): number {
  const sale = (p as any).salePriceCents;
  return isSaleActive(p) && typeof sale === 'number' ? sale : (p as any).priceCents;
}

/** Escape user text for safe RegExp use */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight tokens from the query safely (bounded → no catastrophic backtracking). */
function highlight(text: string, q: string): React.ReactNode {
  const t = (q || '').trim();
  if (!t) return text;

  const tokens = Array.from(new Set(t.split(/\s+/g).filter(Boolean)))
    .slice(0, 8)
    .map((s) => s.slice(0, 40));

  if (tokens.length === 0) return text;

  const pattern = tokens.map(escapeRegExp).join('|');
  const re = new RegExp(`(?:${pattern})`, 'ig');

  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) != null) {
    const start = m.index;
    const end = start + m[0].length;

    if (start > last) {
      parts.push(<span key={`t-${last}-${start}`}>{text.slice(last, start)}</span>);
    }

    parts.push(
      <mark
        key={`h-${start}-${end}`}
        style={{
          background: 'var(--theme-pill-yellow)',
          color: 'var(--theme-text)',
          padding: '0 2px',
          borderRadius: 3,
        }}
      >
        {text.slice(start, end)}
      </mark>
    );

    last = end;
  }

  if (last < text.length) {
    parts.push(<span key={`t-${last}-${text.length}`}>{text.slice(last)}</span>);
  }

  return parts;
}

/** ---------- Pick an image + make a public URL ---------- */
type AnyImage = {
  v320Path?: string | null;
  v800Path?: string | null;
  v1600Path?: string | null;
  origPath?: string | null;
  isPrimary?: boolean | null;
  is_default_global?: boolean | null;
};

function selectImageRecord(p: any): AnyImage | null {
  if (p.primaryImage) return p.primaryImage as AnyImage;

  const arrays: AnyImage[][] = [
    p.images ?? [],
    p.photos ?? [],
    p.product_images ?? [],
    p.productImages ?? [],
  ];

  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) {
      const pri =
        arr.find((i: AnyImage) => i?.isPrimary) ??
        arr.find((i: AnyImage) => i?.is_default_global) ??
        null;
      return pri ?? arr[0];
    }
  }
  return null;
}

function imageUrlForCard(p: any): string | null {
  const rec = selectImageRecord(p);
  if (!rec) return null;
  const rel = rec.v800Path || rec.v320Path || rec.v1600Path || rec.origPath || null;
  if (!rel) return null;
  const withPrefix = rel.startsWith('/uploads/') ? rel : `/uploads/${rel}`;
  return joinUrl(API_BASE, withPrefix);
}

/** ---------- Helpers to support dollar inputs ---------- */
function centsToDollarInput(cents?: number): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  const whole = Math.trunc(cents);
  // Show clean integer dollars when possible (e.g., 6500 → "65")
  return whole % 100 === 0 ? String(whole / 100) : (whole / 100).toFixed(2);
}
function dollarsStrToCents(s: string): number | undefined {
  const t = (s || '').trim();
  if (!t) return undefined;
  // allow "$", commas, spaces; keep first dot for decimals
  const cleaned = t.replace(/[$,\s]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

/** ---------- Types/State ---------- */
type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
  kind: 'loaded';
  data: { items: Product[]; total: number; page: number; totalPages: number };
}
  | { kind: 'error'; message: string };

type SortValue = 'newest' | 'price_asc' | 'price_desc';

type FormState = {
  species: string;
  vendorSlug: string;
  onSale: boolean;
  synthetic: boolean;
  /** store dollars as strings in the form; convert to cents on submit */
  priceMinDollars: string;
  priceMaxDollars: string;
  sort: SortValue;
  pageSize: string;
};

export default function ProductList(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  // mobile collapse state
  const [filtersOpen, setFiltersOpen] = useState(false);

  // 🔎 Debounced keyword search (persisted in query params)
  const [inputQ, setInputQ] = useState<string>(params.get('q') ?? '');
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (inputQ.trim()) next.set('q', inputQ.trim());
      else next.delete('q');
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputQ]);

  // Parse URL → typed query (includes `q`)
  const query: ListQuery = useMemo(() => {
    const pageRaw = Number(params.get('page') || 1);
    const pageSizeRaw = Number(params.get('pageSize') || 24);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 24;

    const q = params.get('q') || undefined;
    const vendorSlug = params.get('vendorSlug') || undefined;
    const species = params.get('species') || undefined;

    const onSaleParam = params.get('onSale');
    const syntheticParam = params.get('synthetic');
    const onSale = onSaleParam == null ? undefined : onSaleParam === 'true';
    const synthetic = syntheticParam == null ? undefined : syntheticParam === 'true';

    const minParam = params.get('priceMinCents');
    const maxParam = params.get('priceMaxCents');
    const priceMinCents =
      minParam != null && minParam !== '' ? Math.max(0, Math.trunc(+minParam)) : undefined;
    const priceMaxCents =
      maxParam != null && maxParam !== '' ? Math.max(0, Math.trunc(+maxParam)) : undefined;

    const sort = (params.get('sort') as ListQuery['sort']) || 'newest';

    return {
      page,
      pageSize,
      q,
      vendorSlug,
      species,
      onSale,
      synthetic,
      priceMinCents,
      priceMaxCents,
      sort,
    };
  }, [params]);

  // Local form mirrors URL; keep in sync if URL changes externally
  const [form, setForm] = useState<FormState>(() => ({
    species: query.species ?? '',
    vendorSlug: query.vendorSlug ?? '',
    onSale: Boolean(query.onSale),
    synthetic: Boolean(query.synthetic),
    priceMinDollars: centsToDollarInput(query.priceMinCents),
    priceMaxDollars: centsToDollarInput(query.priceMaxCents),
    sort: (query.sort ?? 'newest') as SortValue,
    pageSize: String(query.pageSize ?? 24),
  }));

  useEffect(() => {
    setForm({
      species: query.species ?? '',
      vendorSlug: query.vendorSlug ?? '',
      onSale: Boolean(query.onSale),
      synthetic: Boolean(query.synthetic),
      priceMinDollars: centsToDollarInput(query.priceMinCents),
      priceMaxDollars: centsToDollarInput(query.priceMaxCents),
      sort: (query.sort ?? 'newest') as SortValue,
      pageSize: String(query.pageSize ?? 24),
    });
    setInputQ(params.get('q') ?? '');
  }, [query, params]);

  // Fetch on query change (route to search when q is present)
  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const qTerm = (params.get('q') ?? '').trim();

      try {
        const resp = qTerm
          ? await searchProducts({
            q: qTerm,
            page: query.page,
            pageSize: query.pageSize,
            sort: query.sort,
            vendorSlug: query.vendorSlug,
          })
          : await listProducts(query);

        if (!alive) return;

        const { data, error, status } = resp;
        if (error || !data) {
          setState({ kind: 'error', message: error || `Failed (${status})` });
          return;
        }

        setState({
          kind: 'loaded',
          data: {
            items: data.items,
            total: data.total,
            page: data.page,
            totalPages: data.totalPages,
          },
        });
      } catch (e: any) {
        if (!alive) return;
        setState({ kind: 'error', message: e?.message || 'Failed to load products' });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function updateQuery(partial: Partial<ListQuery>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(partial)) {
      if (v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    if (!('page' in partial)) next.set('page', '1');
    setParams(next, { replace: true });
  }

  function submitFilters(e: React.FormEvent) {
    e.preventDefault();

    // Convert dollar strings → integer cents for URL params
    const minCents = dollarsStrToCents(form.priceMinDollars);
    const maxCents = dollarsStrToCents(form.priceMaxDollars);

    updateQuery({
      species: form.species.trim() || undefined,
      vendorSlug: form.vendorSlug.trim() || undefined,
      onSale: form.onSale ? true : undefined,
      synthetic: form.synthetic ? true : undefined,
      priceMinCents: minCents,
      priceMaxCents: maxCents,
      sort: form.sort as ListQuery['sort'],
      pageSize: Math.max(1, Math.trunc(+form.pageSize)) || 24,
    });
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(Math.max(1, p)));
    setParams(next, { replace: true });
  }

  const skeletonKeys = useMemo(() => Array.from({ length: 9 }, (_, i) => `sk-${i}`), []);
  const card: React.CSSProperties = {
    background: 'var(--theme-card)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  };
  const qStr = params.get('q') ?? '';

  return (
    <section className="mx-auto max-w-12xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Catalog</h1>

      {/* Search + Filters (collapsible 0–1023px; always open at 1024px+) */}
      <div className="w-full rounded-xl border" style={card}>
        {/* Toggle header — visible only below lg */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full lg:hidden flex items-center justify-between px-4 py-3"
          aria-expanded={filtersOpen}
          aria-controls="filters-panel"
        >
          <span className="font-semibold">Search & Filters</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* The form: hidden below lg when collapsed; always grid at lg+ */}
        <form
          id="filters-panel"
          onSubmit={submitFilters}
          className={`p-4 grid gap-3 lg:grid-cols-12 ${filtersOpen ? 'grid' : 'hidden'} lg:grid`}
        >
          {/* 🔎 Keyword search (debounced -> query param) */}
          <input
            className="lg:col-span-4 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Search title/species/locality…"
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            aria-label="Search"
          />

          <input
            className="lg:col-span-3 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Species"
            value={form.species}
            onChange={(e) => setForm((s) => ({ ...s, species: e.target.value }))}
          />
          <input
            className="lg:col-span-3 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Vendor name"
            value={form.vendorSlug}
            onChange={(e) => setForm((s) => ({ ...s, vendorSlug: e.target.value }))}
          />
          <input
            className="lg:col-span-1 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Min $"
            inputMode="decimal"
            value={form.priceMinDollars}
            onChange={(e) => setForm((s) => ({ ...s, priceMinDollars: e.target.value }))}
            aria-label="Minimum price (USD)"
          />
          <input
            className="lg:col-span-1 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Max $"
            inputMode="decimal"
            value={form.priceMaxDollars}
            onChange={(e) => setForm((s) => ({ ...s, priceMaxDollars: e.target.value }))}
            aria-label="Maximum price (USD)"
          />
          <select
            className="lg:col-span-2 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            value={form.sort}
            onChange={(e) => setForm((s) => ({ ...s, sort: e.target.value as SortValue }))}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>

          <div className="lg:col-span-12 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.onSale}
                onChange={(e) => setForm((s) => ({ ...s, onSale: e.target.checked }))}
              />
              <span>On sale (now)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.synthetic}
                onChange={(e) => setForm((s) => ({ ...s, synthetic: e.target.checked }))}
              />
              <span>Synthetic</span>
            </label>
            <select
              className="rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
              value={form.pageSize}
              onChange={(e) => setForm((s) => ({ ...s, pageSize: e.target.value }))}
              title="Per page"
            >
              {['12', '24', '48'].map((n) => (
                <option key={`pp-${n}`} value={n}>
                  {n} / page
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="ml-auto inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
            >
              Apply
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {state.kind === 'loading' && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {skeletonKeys.map((k) => (
            <div
              key={k}
              className="h-44 rounded-lg animate-pulse"
              style={{ background: 'var(--theme-card)' }}
            />
          ))}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-md border p-3 text-sm" style={card}>
          {state.message}
        </div>
      )}

      {state.kind === 'loaded' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {state.data.items.map((p) => {
              const onSaleNow = isSaleActive(p);
              const eff = effectivePriceCents(p);

              const priceEl = onSaleNow ? (
                <div className="text-sm">
                  <span className="line-through opacity-60 mr-1">
                    {centsToUsd((p as any).priceCents)}
                  </span>
                  <span>{centsToUsd(eff)}</span>
                </div>
              ) : (
                <div className="text-sm">{centsToUsd(eff)}</div>
              );

              const imgSrc = imageUrlForCard(p);

              return (
                <Link
                  key={(p as any).id}
                  to={`/products/${(p as any).id}`}
                  className="rounded-xl border p-3 hover:shadow"
                  style={card}
                >
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={(p as any).title}
                      className="h-72 w-full rounded object-cover mb-3"
                      style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                      onError={(ev) => {
                        const el = ev.currentTarget;
                        el.style.display = 'none';
                        const placeholder = el.nextElementSibling as HTMLElement | null;
                        if (placeholder) placeholder.style.display = 'block';
                      }}
                    />
                  ) : null}
                  <div
                    className="h-36 w-full rounded bg-[var(--theme-card-alt)] mb-3"
                    style={{ display: imgSrc ? 'none' : 'block' }}
                  />

                  <div className="truncate font-semibold">
                    {highlight((p as any).title, qStr)}
                  </div>
                  {priceEl}
                  {(p as any).species ? (
                    <div className="text-xs opacity-70">
                      {highlight((p as any).species, qStr)}
                    </div>
                  ) : null}
                  {(p as any).locality ? (
                    <div className="text-xs opacity-70">
                      {highlight((p as any).locality, qStr)}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm opacity-80">
              Page {state.data.page} / {state.data.totalPages} · {state.data.total} results
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={state.data.page <= 1}
                onClick={() => goToPage(state.data.page - 1)}
                className="rounded px-3 py-1 text-sm disabled:opacity-50"
                style={{
                  background: 'var(--theme-surface)',
                  color: 'var(--theme-text)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={state.data.page >= state.data.totalPages}
                onClick={() => goToPage(state.data.page + 1)}
                className="rounded px-3 py-1 text-sm disabled:opacity-50"
                style={{
                  background: 'var(--theme-surface)',
                  color: 'var(--theme-text)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
