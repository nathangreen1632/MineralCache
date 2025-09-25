// Client/src/pages/products/ProductList.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { listProducts, type ListQuery, type Product } from '../../api/products';

function centsToUsd(cents?: number | null): string {
  const n = typeof cents === 'number' ? Math.max(0, Math.trunc(cents)) : 0;
  return `$${(n / 100).toFixed(2)}`;
}

function isSaleActive(p: Product, now = new Date()): boolean {
  if (p.salePriceCents == null) return false;
  const startOk = !p.saleStartAt || new Date(p.saleStartAt) <= now;
  const endOk = !p.saleEndAt || now <= new Date(p.saleEndAt);
  return startOk && endOk;
}

function effectivePriceCents(p: Product): number {
  if (isSaleActive(p)) return p.salePriceCents as number;
  return p.priceCents;
}

/** Escape user text for safe RegExp use */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight all tokens from the query; case-insensitive.
 * Uses substring start/end offsets for keys (no array index keys).
 */
function highlight(text: string, q: string): React.ReactNode {
  if (!q?.trim()) return text;

  const tokens = Array.from(new Set(q.trim().split(/\s+/g).filter(Boolean)));
  if (tokens.length === 0) return text;

  const re = new RegExp(tokens.map((t) => escapeRegExp(t)).join('|'), 'ig');

  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) != null) {
    const start = match.index;
    const end = start + match[0].length;

    // plain chunk before match
    if (start > lastIndex) {
      out.push(
        <span key={`t-${lastIndex}-${start}`}>{text.slice(lastIndex, start)}</span>
      );
    }

    // highlighted match
    out.push(
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

    lastIndex = end;
  }

  // trailing plain chunk
  if (lastIndex < text.length) {
    out.push(
      <span key={`t-${lastIndex}-${text.length}`}>{text.slice(lastIndex)}</span>
    );
  }

  return out;
}

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
  priceMinCents: string;
  priceMaxCents: string;
  sort: SortValue;
  pageSize: string;
};

export default function ProductList(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  // 🔎 Debounced keyword search (persisted in query params)
  const [inputQ, setInputQ] = useState<string>(params.get('q') ?? '');
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (inputQ.trim()) next.set('q', inputQ.trim());
      else next.delete('q');
      // reset paging when the query changes
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputQ]);

  // Parse URL → typed query (added `q`)
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
    priceMinCents: query.priceMinCents?.toString() ?? '',
    priceMaxCents: query.priceMaxCents?.toString() ?? '',
    sort: (query.sort ?? 'newest') as SortValue,
    pageSize: String(query.pageSize ?? 24),
  }));

  useEffect(() => {
    setForm({
      species: query.species ?? '',
      vendorSlug: query.vendorSlug ?? '',
      onSale: Boolean(query.onSale),
      synthetic: Boolean(query.synthetic),
      priceMinCents: query.priceMinCents?.toString() ?? '',
      priceMaxCents: query.priceMaxCents?.toString() ?? '',
      sort: (query.sort ?? 'newest') as SortValue,
      pageSize: String(query.pageSize ?? 24),
    });
    // keep search box in sync if URL changed externally
    setInputQ(params.get('q') ?? '');
  }, [query, params]);

  // Fetch on query change
  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      try {
        const { data, error, status } = await listProducts(query);
        if (!alive) return;
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
    // Whenever filters change, reset to page 1 (unless caller explicitly set a page)
    if (!('page' in partial)) {
      next.set('page', '1');
    }
    setParams(next, { replace: true });
  }

  function submitFilters(e: React.FormEvent) {
    e.preventDefault();
    updateQuery({
      species: form.species.trim() || undefined,
      vendorSlug: form.vendorSlug.trim() || undefined,
      onSale: form.onSale ? true : undefined,
      synthetic: form.synthetic ? true : undefined,
      priceMinCents: form.priceMinCents ? Math.max(0, Math.trunc(+form.priceMinCents)) : undefined,
      priceMaxCents: form.priceMaxCents ? Math.max(0, Math.trunc(+form.priceMaxCents)) : undefined,
      sort: form.sort as ListQuery['sort'],
      pageSize: Math.max(1, Math.trunc(+form.pageSize)) || 24,
    });
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(Math.max(1, p)));
    setParams(next, { replace: true });
  }

  // Stable keys for skeletons
  const skeletonKeys = useMemo(() => Array.from({ length: 9 }, (_, i) => `sk-${i}`), []);

  // styles
  const card: React.CSSProperties = {
    background: 'var(--theme-card)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  };

  const qStr = params.get('q') ?? '';

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Catalog</h1>

      {/* Search + Filters */}
      <form
        onSubmit={submitFilters}
        className="rounded-xl border p-4 grid gap-3 md:grid-cols-12"
        style={card}
      >
        {/* 🔎 Keyword search (debounced -> query param) */}
        <input
          className="md:col-span-4 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          placeholder="Search title/species/locality…"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          aria-label="Search"
        />

        <input
          className="md:col-span-3 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          placeholder="Species"
          value={form.species}
          onChange={(e) => setForm((s) => ({ ...s, species: e.target.value }))}
        />
        <input
          className="md:col-span-3 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          placeholder="Vendor slug"
          value={form.vendorSlug}
          onChange={(e) => setForm((s) => ({ ...s, vendorSlug: e.target.value }))}
        />
        <input
          className="md:col-span-1 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          placeholder="Min ¢"
          inputMode="numeric"
          value={form.priceMinCents}
          onChange={(e) => setForm((s) => ({ ...s, priceMinCents: e.target.value }))}
        />
        <input
          className="md:col-span-1 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          placeholder="Max ¢"
          inputMode="numeric"
          value={form.priceMaxCents}
          onChange={(e) => setForm((s) => ({ ...s, priceMaxCents: e.target.value }))}
        />
        <select
          className="md:col-span-2 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
          value={form.sort}
          onChange={(e) => setForm((s) => ({ ...s, sort: e.target.value as SortValue }))}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>

        <div className="md:col-span-12 flex flex-wrap items-center gap-4">
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {state.data.items.map((p) => {
              const onSaleNow = isSaleActive(p);
              const eff = effectivePriceCents(p);

              let priceEl: React.ReactNode = <div className="text-sm">{centsToUsd(eff)}</div>;
              if (onSaleNow) {
                priceEl = (
                  <div className="text-sm">
                    <span className="line-through opacity-60 mr-1">
                      {centsToUsd(p.priceCents)}
                    </span>
                    <span>{centsToUsd(eff)}</span>
                  </div>
                );
              }

              return (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="rounded-xl border p-3 hover:shadow"
                  style={card}
                >
                  <div className="h-36 w-full rounded bg-[var(--theme-card-alt)] mb-3" />
                  <div className="truncate font-semibold">
                    {highlight(p.title, qStr)}
                  </div>
                  {priceEl}
                  <div className="text-xs opacity-70">
                    {p.species ? highlight(p.species, qStr) : null}
                  </div>
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
