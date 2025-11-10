// Client/src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import AutoCarousel from '../components/media/AutoCarousel';
import ProductCard from '../components/products/ProductCard';
import { getFeaturedPhotos, getOnSaleProducts } from '../api/public';
import CategoriesRow from '../components/categories/CategoriesRow';
import logoWords from '../assets/mc_logo_words.webp';

const PAGE_SIZE = 8;

export default function HomePage(): React.ReactElement {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [onSale, setOnSale] =
    useState<Awaited<ReturnType<typeof getOnSaleProducts>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  let heroContent: React.ReactNode;
  if (photos === null) {
    heroContent = (
      <div
        className="rounded-2xl border p-6 h-80 animate-pulse
                   border-[var(--theme-border)] bg-[var(--theme-card)]"
      >
        <div className="h-full w-full bg-[var(--theme-surface)] rounded-xl" />
      </div>
    );
  } else if (photos.length === 0) {
    heroContent = (
      <div
        className="rounded-2xl border p-6 mt-12
                   border-[var(--theme-border)] bg-[var(--theme-card)]"
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
        ctaLabel="SHOP NOW"
        ctaClassName="animate-bounce-3s"
      />
    );
  }

  const visibleOnSale = useMemo(() => {
    if (!onSale) return [];
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return onSale.slice(start, end);
  }, [onSale, page]);

  const canPrev = page > 1;
  const canNext = (onSale?.length ?? 0) === effectiveLimit;

  let onSaleContent: React.ReactNode;
  if (onSale === null) {
    onSaleContent = (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {skeletonKeys.map((key) => (
          <div
            key={key}
            className="rounded-2xl border p-4 animate-pulse
                       border-[var(--theme-border)] bg-[var(--theme-card)]"
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
        className="rounded-2xl border p-6
                   border-[var(--theme-border)] bg-[var(--theme-card)]"
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
              vendorSlug={p.vendorSlug ?? undefined}
              vendorName={p.vendorName ?? undefined}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="inline-flex rounded-xl px-4 py-2 font-semibold
                       bg-[var(--theme-button)] text-[var(--theme-text-white)]
                       hover:bg-[var(--theme-button-hover)]
                       focus-visible:ring-2 focus-visible:ring-offset-2
                       focus-visible:ring-[var(--theme-focus)]
                       focus-visible:ring-offset-[var(--theme-surface)]
                       disabled:opacity-80 shadow-[0_2px_5px_var(--theme-shadow-categories)]"
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
            className="inline-flex rounded-xl px-4 py-2 font-semibold
                       bg-[var(--theme-button)] text-[var(--theme-text-white)]
                       hover:bg-[var(--theme-button-hover)]
                       focus-visible:ring-2 focus-visible:ring-offset-2
                       focus-visible:ring-[var(--theme-focus)]
                       focus-visible:ring-offset-[var(--theme-surface)]
                       disabled:opacity-80 shadow-[0_2px_5px_var(--theme-shadow-categories)]"
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
      <header className="mt-1 flex justify-center">
        <img
          src={logoWords}
          alt="MineralCache — Buy. Sell. Discover. The Mineral and Fossil Marketplace."
          className="mx-auto h-auto w-full max-w-[900px] rounded-2xl mt-8 sm:mt-2"
          style={{ filter: 'drop-shadow(0 1px 4px var(--theme-shadow-carousel))' }}
        />
      </header>

      <section>{heroContent}</section>

      <section>
        <CategoriesRow />
      </section>

      <section className="space-y-3 mb-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-[var(--theme-text)]">On Sale</h2>
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
            className="rounded-md border p-3
                       border-[var(--theme-border)] bg-[var(--theme-card-alt)]"
          >
            <p className="text-sm text-[var(--theme-error)]">{err}</p>
          </div>
        )}
      </section>
    </div>
  );
}
