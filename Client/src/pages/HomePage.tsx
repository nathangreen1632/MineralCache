// Client/src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/products/ProductCard';
import { getOnSaleProducts, getShopNowProducts } from '../api/public';
import CategoriesRow from '../components/categories/CategoriesRow';
import BrandWordmark from '../common/BrandWordmark';
import {pressBtn} from "../ui/press.ts";

const PAGE_SIZE = 12;
const HOME_FETCH_LIMIT = PAGE_SIZE * 8;

export default function HomePage(): React.ReactElement {
  const [shopNow, setShopNow] =
    useState<Awaited<ReturnType<typeof getShopNowProducts>> | null>(null);
  const [onSale, setOnSale] =
    useState<Awaited<ReturnType<typeof getOnSaleProducts>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [shopPage, setShopPage] = useState(1);
  const [salePage, setSalePage] = useState(1);

  const skeletonKeys = useMemo(() => {
    const count = PAGE_SIZE;

    if (globalThis.crypto && 'randomUUID' in globalThis.crypto) {
      return Array.from({ length: count }, () => globalThis.crypto.randomUUID());
    }
    if (globalThis.crypto && 'getRandomValues' in globalThis.crypto) {
      return Array.from({ length: count }, () => {
        const buf = new Uint32Array(4);
        globalThis.crypto.getRandomValues(buf);
        return Array.from(buf)
          .map((n) => n.toString(16).padStart(8, '0'))
          .join('');
      });
    }
    const base = Date.now().toString(36);
    return Array.from({ length: count }, (_, i) => `sk-${base}-${i}`);
  }, []);

  // Load Shop Now (non-sale) products once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const regular = await getShopNowProducts({ limit: HOME_FETCH_LIMIT });
        if (!alive) return;
        setShopNow(regular);
      } catch (e: any) {
        if (!alive) return;
        setShopNow([]);
        setErr(e?.message || 'Failed to load content.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load On Sale products once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sale = await getOnSaleProducts({ limit: HOME_FETCH_LIMIT });
        if (!alive) return;
        setOnSale(sale);
      } catch (e: any) {
        if (!alive) return;
        setOnSale([]);
        setErr(e?.message || 'Failed to load content.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const visibleShopNow = useMemo(() => {
    if (!shopNow) return [];
    const start = (shopPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return shopNow.slice(start, end);
  }, [shopNow, shopPage]);

  const visibleOnSale = useMemo(() => {
    if (!onSale) return [];
    const start = (salePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return onSale.slice(start, end);
  }, [onSale, salePage]);

  const shopTotal = shopNow?.length ?? 0;
  const shopTotalPages = Math.max(1, Math.ceil(shopTotal / PAGE_SIZE));

  const saleTotal = onSale?.length ?? 0;
  const saleTotalPages = Math.max(1, Math.ceil(saleTotal / PAGE_SIZE));

  const canPrevShopNow = shopPage > 1;
  const canPrevOnSale = salePage > 1;

  const canNextShopNow = shopPage < shopTotalPages;
  const canNextOnSale = salePage < saleTotalPages;

  let shopNowContent: React.ReactNode;
  if (shopNow === null) {
    shopNowContent = (
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
  } else if (visibleShopNow.length === 0) {
    shopNowContent = (
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
    shopNowContent = (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {visibleShopNow.map((p) => (
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

        {/* Shop Now Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm opacity-80">
            Page {shopPage} / {shopTotalPages} · {shopTotal} results
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canPrevShopNow}
              onClick={() => setShopPage((p) => Math.max(1, p - 1))}
              className={pressBtn("rounded px-3 py-1 text-sm disabled:opacity-50")}
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-border)',
              }}
              aria-label="Previous Shop Now page"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNextShopNow}
              onClick={() => setShopPage((p) => p + 1)}
              className={pressBtn("rounded px-3 py-1 text-sm disabled:opacity-50")}
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-border)',
              }}
              aria-label="Next Shop Now page"
            >
              Next
            </button>
          </div>
        </div>
      </>
    );
  }

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

        {/* On Sale Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm opacity-80">
            Page {salePage} / {saleTotalPages} · {saleTotal} results
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canPrevOnSale}
              onClick={() => setSalePage((p) => Math.max(1, p - 1))}
              className={pressBtn("rounded px-3 py-1 text-sm disabled:opacity-50")}
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-border)',
              }}
              aria-label="Previous On Sale page"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNextOnSale}
              onClick={() => setSalePage((p) => p + 1)}
              className={pressBtn("rounded px-3 py-1 text-sm disabled:opacity-50")}
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-border)',
              }}
              aria-label="Next On Sale page"
            >
              Next
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-12">
      <header className="mt-1 flex justify-center">
        <BrandWordmark className="mx-auto h-auto w-full max-w-[1200px] rounded-2xl mt-8 sm:mt-2 drop-shadow(0 1px 4px var(--theme-shadow-carousel))" />
      </header>

      <section>
        <CategoriesRow />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="
              text-4xl font-extrabold
              bg-gradient-to-r
              from-[var(--theme-button-yellow)]
              to-[var(--theme-card-number)]
              bg-clip-text
              text-transparent
            "
          >
            Shop Now
          </h2>
          <a
            href="/products"
            className="text-sm underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          >
            Browse all
          </a>
        </div>

        {shopNowContent}
      </section>

      <section className="space-y-3 mb-12">
        <div className="flex items-center justify-between">
          <h2
            className="
              text-4xl font-extrabold
              bg-gradient-to-r
              from-[var(--theme-button-yellow)]
              to-[var(--theme-card-number)]
              bg-clip-text
              text-transparent
            "
          >
            On Sale
          </h2>
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
