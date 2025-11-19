import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { centsToUsd } from '../../utils/money.util';
import { pressBtn } from '../../ui/press.ts';
import {
  useProductShopListController,
  isSaleActive,
  effectivePriceCents,
  getVendorFromProduct,
  imageUrlForCard,
} from '../../pages/products/ProductShopListLogic';

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      </mark>,
    );

    last = end;
  }

  if (last < text.length) {
    parts.push(<span key={`t-${last}-${text.length}`}>{text.slice(last)}</span>);
  }

  return parts;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-card)',
  borderColor: 'var(--theme-border)',
  color: 'var(--theme-text)',
};

export default function ProductShopListView(): React.ReactElement {
  const {
    state,
    filtersOpen,
    setFiltersOpen,
    inputQ,
    setInputQ,
    form,
    setForm,
    submitFilters,
    goToPage,
    skeletonKeys,
    qStr,
  } = useProductShopListController();

  return (
    <section className="mx-auto max-w-12xl px-4 py-8 space-y-6">
      <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Shop</h1>

      <div className="w-full rounded-xl border" style={cardStyle}>
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
            className={`h-5 w-5 transition-transform duration-200 ${
              filtersOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <form
          id="filters-panel"
          onSubmit={submitFilters}
          className={`p-4 grid gap-3 lg:grid-cols-12 ${
            filtersOpen ? 'grid' : 'hidden'
          } lg:grid`}
        >
          <input
            className="lg:col-span-4 rounded border px-3 py-2 bg-[var(--theme-textbox)] border-[var(--theme-border)]"
            placeholder="Search title/species/locality…"
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            aria-label="Search"
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
            onChange={(e) => setForm((s) => ({ ...s, sort: e.target.value as any }))}
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
              className={pressBtn(
                'ml-auto inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold',
              )}
              style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
            >
              Apply
            </button>
          </div>
        </form>
      </div>

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
        <div className="rounded-md border p-3 text-sm" style={cardStyle}>
          {state.message}
        </div>
      )}

      {state.kind === 'loaded' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {state.data.items.map((p: any) => {
              const onSaleNow = isSaleActive(p);
              const eff = effectivePriceCents(p);

              const priceEl = onSaleNow ? (
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-[var(--theme-success)]">
                    {centsToUsd(eff)}
                  </span>
                  <span className="text-xs line-through text-[var(--theme-muted)]">
                    {centsToUsd((p).priceCents)}
                  </span>
                </div>
              ) : (
                <span className="font-bold text-[var(--theme-success)]">
                  {centsToUsd(eff)}
                </span>
              );

              const imgSrc = imageUrlForCard(p);
              const { slug: vendorSlug, name: vendorName } = getVendorFromProduct(p);
              const vendorLabel = vendorName || vendorSlug || '';

              return (
                <div
                  key={(p).id}
                  className="rounded-xl border p-3 hover:shadow shadow-[0_3px_5px_var(--theme-shadow-carousel)] duration-900"
                  style={cardStyle}
                >
                  {imgSrc ? (
                    <Link
                      to={`/products/${(p).id}`}
                      className="block relative mb-3"
                      aria-label={`View product: ${(p).title}`}
                    >
                      <img
                        src={imgSrc}
                        alt={(p).title}
                        className="h-72 w-full rounded object-cover"
                        style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                        onError={(ev) => {
                          const el = ev.currentTarget;
                          el.style.display = 'none';
                          const placeholder = el.nextElementSibling as HTMLElement | null;
                          if (placeholder) placeholder.style.display = 'grid';
                        }}
                      />
                      <div className="absolute inset-0 hidden place-items-center rounded bg-[var(--theme-card-alt)] text-xs opacity-70">
                        No image
                      </div>
                      {onSaleNow && (
                        <span
                          className="absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shadow"
                          style={{
                            background: 'var(--theme-button-yellow)',
                            color: 'var(--theme-text-black)',
                          }}
                          aria-label="On sale"
                        >
                          On Sale
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="relative mb-3 h-72 w-full rounded bg-[var(--theme-card-alt)]">
                      {onSaleNow && (
                        <span
                          className="absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shadow"
                          style={{
                            background: 'var(--theme-button)',
                            color: 'var(--theme-text-white)',
                          }}
                          aria-label="On sale"
                        >
                          On Sale
                        </span>
                      )}
                    </div>
                  )}

                  <div className="truncate font-semibold">
                    {highlight((p).title, qStr)}
                  </div>

                  {priceEl}

                  <div className="mt-0.5 text-sm text-[var(--theme-text)]">
                    <span className="opacity-75">Sold by:</span>{' '}
                    {vendorSlug ? (
                      <Link
                        to={`/vendors/${vendorSlug}`}
                        className="capitalize underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                        aria-label={`View vendor storefront: ${vendorLabel}`}
                      >
                        {vendorLabel}
                      </Link>
                    ) : null}
                  </div>

                  {(p).species ? (
                    <div className="text-sm opacity-70">
                      {highlight((p).species, qStr)}
                    </div>
                  ) : null}
                  {(p).locality ? (
                    <div className="text-xs opacity-70">
                      {highlight((p).locality, qStr)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm opacity-80">
              Page {state.data.page} / {state.data.totalPages} · {state.data.total} results
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={state.data.page <= 1}
                onClick={() => goToPage(state.data.page - 1)}
                className={pressBtn('rounded px-3 py-1 text-sm disabled:opacity-50')}
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
                className={pressBtn('rounded px-3 py-1 text-sm disabled:opacity-50')}
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
