// Client/src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import AutoCarousel from '../components/media/AutoCarousel';
import ProductCard from '../components/products/ProductCard';
import { getFeaturedPhotos, getOnSaleProducts } from '../api/public';

export default function HomePage(): React.ReactElement {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [onSale, setOnSale] =
    useState<Awaited<ReturnType<typeof getOnSaleProducts>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        const [fp, sale] = await Promise.all([getFeaturedPhotos(), getOnSaleProducts()]);
        if (!alive) return;
        setPhotos(fp);
        setOnSale(sale);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'Failed to load content.');
        setPhotos([]);
        setOnSale([]);
      }
    })();
    return () => { alive = false; };
  }, []);

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

  let onSaleContent: React.ReactNode;
  if (onSale === null) {
    onSaleContent = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  } else if (onSale.length === 0) {
    onSaleContent = (
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <p className="text-sm text-[var(--theme-muted)]">
          No items on sale right now. Check back soon!
        </p>
      </div>
    );
  } else {
    onSaleContent = (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {onSale.map((p) => (
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
