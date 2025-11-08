// Client/src/pages/CategoryPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listCategories, listProductsByCategory, type PublicCategory } from '../api/public';
import ProductCard from '../components/products/ProductCard';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: ProductListItem[]; total: number }
  | { kind: 'error'; message: string };

type ProductListItem = {
  id: number;
  slug?: string | null;
  title?: string | null;
  name?: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  primaryImageUrl?: string | null;
  imageUrl?: string | null;
  vendorId?: number | null;
  vendorSlug?: string | null;
  vendorName?: string | null;
};

const PAGE_SIZE = 24;

export default function CategoryPage(): React.ReactElement {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';

  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc'>('newest');

  // filters (revealed AFTER first successful load)
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>(''); // populated from data
  const [onSale, setOnSale] = useState(false);

  const title = useMemo(() => {
    const found = cats.find((c) => c.slug === slug);
    if (found) return found.name;
    // fallback prettify
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }, [cats, slug]);

  useEffect(() => {
    async function prime() {
      try {
        const list = await listCategories();
        setCats(list);
      } catch {
        // non-fatal
      }
    }
    void prime(); // ← avoid "Promise returned is ignored"
  }, []);

  // --------- CHANGED: treat blank price fields as "not set" (don’t coerce '' → 0) ---------
  async function fetchPage(p = page) {
    setState({ kind: 'loading' });
    try {
      const minStr = (priceMin ?? '').trim();
      const maxStr = (priceMax ?? '').trim();

      const parsedMin = minStr === '' ? undefined : Number(minStr);
      const parsedMax = maxStr === '' ? undefined : Number(maxStr);

      const resp = await listProductsByCategory<ProductListItem>({
        slug,
        page: p,
        pageSize: PAGE_SIZE,
        sort,
        priceMin:
          typeof parsedMin === 'number' &&
          Number.isFinite(parsedMin) &&
          parsedMin >= 0
            ? parsedMin
            : undefined,
        priceMax:
          typeof parsedMax === 'number' &&
          Number.isFinite(parsedMax) &&
          parsedMax >= 0
            ? parsedMax
            : undefined,
        vendorId: vendorId ? Number(vendorId) : undefined,
        onSale, // public.ts will only send this when true
      });

      // Derive vendor list after initial load
      if (!showFilters) setShowFilters(true);

      setState({ kind: 'loaded', items: resp.items ?? [], total: resp.total ?? 0 });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setState({ kind: 'error', message: 'Failed to load products' });
    }
  }
  // -----------------------------------------------------------------------------------------

  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    void fetchPage(1); // ← avoid ignored-promise warning
  }, [slug, sort]); // these are the only auto-triggers by design

  function onApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void fetchPage(1); // ← avoid ignored-promise warning
  }

  function onClearFilters() {
    setPriceMin('');
    setPriceMax('');
    setVendorId('');
    setOnSale(false);
    setPage(1);
    void fetchPage(1); // ← avoid ignored-promise warning
  }

  const items: ProductListItem[] = state.kind === 'loaded' ? state.items : [];

  // Build vendor select options from loaded items
  // Build vendor select options from loaded items
  const vendorOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const it of items) {
      const vid = Number(it.vendorId);
      if (!Number.isFinite(vid) || vid <= 0) continue;

      const label =
        (it.vendorName?.trim()) ||
        (it.vendorSlug?.trim()) ||
        `Vendor #${vid}`;

      if (!map.has(vid)) map.set(vid, label);
    }
    return Array.from(map.entries());
  }, [items]);


  const total = state.kind === 'loaded' ? state.total : 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  // Stable keys for loading skeleton (no array index, no Math.random)
  const loadingKeys = useMemo<string[]>(() => {
    const count = 8;

    // Secure ID generator
    const makeId = (): string => {
      const c = globalThis.crypto as Crypto | undefined;

      // Prefer native UUID if available
      if (c && typeof (c as any).randomUUID === 'function') {
        return (c as any).randomUUID();
      }

      // Otherwise use CSPRNG bytes
      if (c && typeof c.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      }

      // Final deterministic fallback (no PRNG)
      // Ensures stability without relying on randomness.
      let counter = (makeId as any)._ctr ?? 0;
      counter += 1;
      (makeId as any)._ctr = counter;
      return `skeleton-${Date.now().toString(36)}-${counter}`;
    };

    return Array.from({ length: count }, () => makeId());
  }, []);


  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-8xl px-6 py-10 grid gap-8">
        <header>
          <nav aria-label="Breadcrumb">
            <ol className="flex gap-2 text-sm">
              <li><Link to="/" className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]">Home</Link></li>
              <li>/</li>
              <li aria-current="page" className="font-semibold">{title}</li>
            </ol>
          </nav>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        </header>

        {/* Filters appear only after first successful load */}
        {showFilters && (
          <form
            onSubmit={onApplyFilters}
            className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 grid gap-4"
            aria-label="Category filters"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="sort" className="block text-sm font-semibold">Sort</label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>
              </div>

              <div>
                <label htmlFor="priceMin" className="block text-sm font-semibold">Min price ($)</label>
                <input
                  id="priceMin"
                  inputMode="decimal"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
                  placeholder="0"
                />
              </div>

              <div>
                <label htmlFor="priceMax" className="block text-sm font-semibold">Max price ($)</label>
                <input
                  id="priceMax"
                  inputMode="decimal"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
                  placeholder="500"
                />
              </div>

              <div>
                <label htmlFor="vendorId" className="block text-sm font-semibold">Vendor</label>
                <select
                  id="vendorId"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
                >
                  <option value="">All vendors</option>
                  {vendorOptions.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={onSale}
                  onChange={(e) => setOnSale(e.target.checked)}
                />
                <span className="text-sm">On sale only</span>
              </label>

              <div className="ml-auto flex gap-3">
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)]"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
                >
                  Apply
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Results */}
        <section aria-live="polite">
          {state.kind === 'loading' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {loadingKeys.map((k) => (
                <div key={k} className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4">
                  <div className="aspect-square rounded-xl bg-[var(--theme-card)] animate-pulse" />
                  <div className="h-4 mt-3 rounded bg-[var(--theme-card)] animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {state.kind === 'error' && (
            <p className="text-red-500">{state.message}</p>
          )}

          {state.kind === 'loaded' && (
            <>
              {items.length === 0 && <p>No products found.</p>}

              {items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {items.map((p) => (
                    <ProductCard
                      key={p.id}
                      id={p.id}
                      slug={p.slug ?? undefined}
                      name={(p.name ?? p.title ?? '').toString()}
                      imageUrl={p.primaryImageUrl ?? undefined}
                      price={Math.round(p.priceCents) / 100}
                      salePrice={
                        typeof p.salePriceCents === 'number'
                          ? Math.round(p.salePriceCents) / 100
                          : undefined
                      }
                      vendorSlug={p.vendorSlug ?? undefined}
                      vendorName={p.vendorName ?? undefined}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = Math.max(1, page - 1);
                    setPage(next);
                    void fetchPage(next); // ← avoid ignored-promise warning
                  }}
                  className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)] disabled:opacity-50"
                >
                  Prev
                </button>

                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const next = Math.min(totalPages, page + 1);
                    setPage(next);
                    void fetchPage(next); // ← avoid ignored-promise warning
                  }}
                  className="inline-flex rounded-xl px-4 py-2 font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
