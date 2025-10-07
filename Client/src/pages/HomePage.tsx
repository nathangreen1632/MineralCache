// Client/src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import AutoCarousel from '../components/media/AutoCarousel';
import ProductCard from '../components/products/ProductCard';
import { getFeaturedPhotos, getOnSaleProducts } from '../api/public';
import CategoriesRow from '../components/categories/CategoriesRow'; // ← NEW

const PAGE_SIZE = 24;

export default function HomePage(): React.ReactElement {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [onSale, setOnSale] =
    useState<Awaited<ReturnType<typeof getOnSaleProducts>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Pager state
  const [page, setPage] = useState(1);
  const effectiveLimit = page * PAGE_SIZE;

  const skeletonKeys = useMemo(() => {
    if (globalThis.crypto && 'randomUUID' in globalThis.crypto) {
      return Array.from({ length: 6 }, () => globalThis.crypto.randomUUID());
    }
    if (globalThis.crypto && 'getRandomValues' in globalThis.crypto) {
      return Array.from({ length: 6 }, () => {
        const buf = new Uint32Array(4);
        globalThis.crypto.getRandomValues(buf);
        return Array.from(buf).map(n => n.toString(16).padStart(8, '0')).join('');
      });
    }
    const base = Date.now().toString(36);
    return Array.from({ length: 6 }, (_, i) => `sk-${base}-${i}`);
  }, []);

  // Fetch featured photos once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fp = await getFeaturedPhotos();
        if (!alive) return;
        setPhotos(fp);
      } catch (e: any) {
        if (!alive) return;
        setPhotos([]);
        setErr(e?.message || 'Failed to load content.');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Fetch on-sale products whenever the page/limit changes
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sale = await getOnSaleProducts({ limit: effectiveLimit });
        if (!alive) return;
        setOnSale(sale);
      } catch (e: any) {
        if (!alive) return;
        setOnSale([]);
        setErr(e?.message || 'Failed to load content.');
      }
    })();
    return () => { alive = false; };
  }, [effectiveLimit]);

  // ---------- Hero ----------
  let heroContent: React.ReactNode;
  if (photos === null) {
    heroContent = (
      <div
        className="rounded-2xl border p-6 h-80 animate-pulse"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <div className="h-full w-full bg-[var(--theme-surface)] rounded-xl" />
      </div>
    );
  } else if (photos.length === 0) {
    heroContent = (
      <div
        className="rounded-2xl border p-6 mt-12"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <h2 className="text-lg font-semibold text-[var(--theme-text)]">
          Welcome to Mineral Cache
        </h2>
        <p className="text-[var(--theme-muted)] text-sm">
          No featured photos yet. Explore the{' '}
          <a href="/products" className="underline">catalog</a>.
        </p>
      </div>
    );
  } else {
    heroContent = (
      <AutoCarousel
        images={photos.slice(0, 10)}
        intervalMs={5000}
        heightClass="h-[24rem] md:h-[32rem] lg:h-[40rem]"
        ctaHref="/products"
        ctaLabel="Shop now"
      />
    );
  }

  // ---------- On Sale grid + pager ----------
  const visibleOnSale = useMemo(() => {
    if (!onSale) return [];
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return onSale.slice(start, end);
  }, [onSale, page]);

  const canPrev = page > 1;
  // If we got exactly `effectiveLimit` items back, there might be more → allow Next
  const canNext = (onSale?.length ?? 0) === effectiveLimit;

  let onSaleContent: React.ReactNode;
  if (onSale === null) {
    onSaleContent = (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {skeletonKeys.map((key) => (
          <div
            key={key}
            className="rounded-2xl border p-4 animate-pulse"
            style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
          >
            <div className="aspect-[4/3] w-full rounded-xl bg-[var(--theme-surface)]" />
            <div className="mt-3 h-4 w-2/3 rounded bg-[var(--theme-surface)]" />
            <div className="mt-2 h-4 w-1/3 rounded bg-[var(--theme-surface)]" />
          </div>
        ))}
      </div>
    );
  } else if (visibleOnSale.length === 0) {
    onSaleContent = (
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <p className="text-sm text-[var(--theme-muted)]">
          No items on this page. Try the previous page.
        </p>
      </div>
    );
  } else {
    onSaleContent = (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {visibleOnSale.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              slug={p.slug}
              name={p.name}
              imageUrl={p.imageUrl || undefined}
              price={p.price}
              salePrice={p.salePrice ?? undefined}
            />
          ))}
        </div>

        {/* Pager */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!canPrev}
            aria-label="Previous page"
          >
            Prev
          </button>

          <span className="text-sm text-[var(--theme-muted)]" aria-live="polite" role="text">
            Page {page}
          </span>

          <button
            type="button"
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
            onClick={() => setPage(p => p + 1)}
            disabled={!canNext}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-12">
      {/* Page header */}
      <header className="mt-2 text-center">
        <span
          role="text"
          aria-level={1}
          className="block text-4xl md:text-6xl font-extrabold tracking-tight text-[var(--theme-text)] mt-12 md:mt-16 lg:mt-20"
        >
          Welcome to Mineral Cache
        </span>
        <span className="block mt-1 text-md md:text-2xl text-[var(--theme-muted)]">
          The best place to buy and sell Minerals and Fossils
        </span>
      </header>

      {/* Hero carousel */}
      <section>{heroContent}</section>

      {/* NEW: Categories row under the carousel */}
      <section>
        <CategoriesRow />
      </section>

      <section className="space-y-3 mb-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[var(--theme-text)]">On sale</h2>
          <a
            href="/products"
            className="text-sm underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          >
            Browse all
          </a>
        </div>

        {onSaleContent}

        {err && (
          <div
            className="rounded-md border p-3"
            style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card-alt)' }}
          >
            <p className="text-sm" style={{ color: 'var(--theme-error)' }}>{err}</p>
          </div>
        )}
      </section>
    </div>
  );
}
