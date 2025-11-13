import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { listProducts, type Product } from '../../api/products';
import { centsToUsd } from '../../utils/money.util';

declare global {
  interface Window {
    __API_BASE__?: string;
  }
}
const API_BASE =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined) ??
  (typeof window !== 'undefined' ? window.__API_BASE__ : undefined) ??
  '';

/** --- tiny helpers copied from ProductList.tsx --- */
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
  const arrays: AnyImage[][] = [p.images ?? [], p.photos ?? [], p.product_images ?? [], p.productImages ?? []];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) {
      const pri = arr.find((i) => i?.isPrimary) ?? arr.find((i) => i?.is_default_global) ?? null;
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

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: { items: Product[]; total: number; page: number; totalPages: number } };

export default function VendorMainPage(): React.ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  const page = useMemo(() => Math.max(1, Number(params.get('page') || 1)), [params]);
  const pageSize = useMemo(() => Math.max(1, Number(params.get('pageSize') || 24)), [params]);
  const sort = (params.get('sort') as 'newest' | 'price_asc' | 'price_desc') || 'newest';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) return;
      setState({ kind: 'loading' });
      try {
        const resp = await listProducts({ vendorSlug: slug, page, pageSize, sort });
        const { data, error, status } = resp;
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
  }, [slug, page, pageSize, sort]);

  function updateParam(k: string, v: string) {
    const next = new URLSearchParams(params);
    next.set(k, v);
    if (k !== 'page') next.set('page', '1');
    setParams(next, { replace: true });
  }
  function goToPage(n: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(Math.max(1, n)));
    setParams(next, { replace: true });
  }

  const skeletonKeys = useMemo(() => Array.from({ length: 9 }, (_, i) => `sk-${i}`), []);
  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-card)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  };

  const titleLabel = 'Vendor';

  return (
    <section className="mx-auto max-w-12xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="capitalize text-2xl font-semibold">
          <span className="text-[var(--theme-text)]">{titleLabel}</span>
          {slug && (
            <>
              :{' '}
              <span className="text-[var(--theme-link)]">{slug}</span>
            </>
          )}
        </h1>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm opacity-80">Sort</label>
          <select
            id="sort"
            className="rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
          <select
            className="rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            value={String(pageSize)}
            onChange={(e) => updateParam('pageSize', e.target.value)}
            title="Per page"
          >
            {['12', '24', '48'].map((n) => (
              <option key={`pp-${n}`} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
      </div>

      {state.kind === 'loading' && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {skeletonKeys.map((k) => (
            <div key={k} className="h-44 rounded-lg animate-pulse" style={{ background: 'var(--theme-card)' }} />
          ))}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-md border p-3 text-sm" style={cardStyle}>
          {state.message}
        </div>
      )}

      {state.kind === 'loaded' && (
        <>
          {state.data.items.length === 0 ? (
            <div className="rounded-md border p-4 text-sm" style={cardStyle}>
              No products found for this vendor.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {state.data.items.map((p) => {
                const imgSrc = imageUrlForCard(p);
                const onSaleNow = isSaleActive(p);
                const eff = effectivePriceCents(p);

                const priceEl = onSaleNow ? (
                  <div className="text-sm">

                    <span className="text-[var(--theme-success)] text-base font-semibold">
                      {centsToUsd(eff)}
                    </span> {''}
                    <span className="line-through opacity-60 mr-1">
                      {centsToUsd((p as any).priceCents)}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--theme-success)] font-semibold">
                    {centsToUsd(eff)}
                  </div>
                );

                return (
                  <Link
                    key={(p as any).id}
                    to={`/products/${(p as any).id}`}
                    className="rounded-xl border p-3 hover:shadow"
                    style={cardStyle}
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
                    <div className="truncate font-semibold">{(p as any).title}</div>
                    {priceEl}
                    {(p as any).species ? (
                      <div className="text-sm opacity-70">{(p as any).species}</div>
                    ) : null}
                    {(p as any).locality ? (
                      <div className="text-xs opacity-70">{(p as any).locality}</div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}

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
