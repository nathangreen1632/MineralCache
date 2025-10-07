// Client/src/components/vendor/VendorProductsTable.tsx
import React, { useEffect, useState } from 'react';
import {
  listVendorProducts,
  setProductOnSale,
  setProductArchived,
  type VendorProductRow,
  type ListVendorProductsParams,
} from '../../api/vendor';
import { Link } from 'react-router-dom';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: VendorProductRow[]; total: number }
  | { kind: 'error'; message: string };

function centsToUsd(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}

export default function VendorProductsTable(): React.ReactElement {
  const [state, setState] = useState<Load>({ kind: 'idle' });
  const [msg, setMsg] = useState<string | null>(null);

  // NEW: filter + sort + paging
  const [status, setStatus] = useState<ListVendorProductsParams['status']>('active');
  const [sort, setSort] = useState<ListVendorProductsParams['sort']>('newest');
  const [page, setPage] = useState(1);
  const pageSize = 100; // keep your previous fetch size

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await listVendorProducts({ page, pageSize, status, sort });
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || 'Failed to load products' });
        return;
      }
      setState({ kind: 'loaded', items: data.items ?? [], total: data.total ?? 0 });
    })();
    return () => { alive = false; };
  }, [page, pageSize, status, sort]);

  async function toggleOnSale(p: VendorProductRow, next: boolean) {
    if (state.kind !== 'loaded') return;
    setMsg(null);
    const prev = [...state.items];
    const local = state.items.map(i => (i.id === p.id ? { ...i, onSale: next } : i));
    setState({ kind: 'loaded', items: local, total: state.total });
    const { error } = await setProductOnSale(p.id, next);
    if (error) {
      setMsg(error);
      setState({ kind: 'loaded', items: prev, total: state.total });
    }
  }

  async function toggleArchived(p: VendorProductRow, next: boolean) {
    if (state.kind !== 'loaded') return;
    setMsg(null);

    // Optimistic UI:
    // - Archiving while viewing "active" → remove from list
    // - Reviving while viewing "archived" → remove from list
    // - Otherwise (e.g., "all") → just flip the flag locally
    const prev = [...state.items];
    let local: VendorProductRow[];

    if (next && status === 'active') {
      local = state.items.filter(i => i.id !== p.id);
    } else if (!next && status === 'archived') {
      local = state.items.filter(i => i.id !== p.id);
    } else {
      local = state.items.map(i => (i.id === p.id ? { ...i, archived: next } : i));
    }

    setState({ kind: 'loaded', items: local, total: state.total });

    const { error } = await setProductArchived(p.id, next);
    if (error) {
      setMsg(error);
      setState({ kind: 'loaded', items: prev, total: state.total });
    }
  }

  const card = {
    background: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  } as const;

  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <div className="rounded-2xl border p-6" style={card}>
        <div className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)' }} />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-2xl border p-6 grid gap-3" style={card}>
        <div className="text-sm" style={{ color: 'var(--theme-error)' }}>{state.message}</div>
      </div>
    );
  }

  const items = state.items;
  const headerStyle = { background: 'var(--theme-card)' } as const;

  const totalPages =
    state.kind === 'loaded' ? Math.max(1, Math.ceil((state.total ?? 0) / pageSize)) : 1;

  return (
    <div className="rounded-2xl border" style={card}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <label className="inline-flex items-center gap-2">
          <span className="text-sm">Show</span>
          <select
            aria-label="Filter products by status"
            className="rounded-xl border px-3 py-2 bg-[var(--theme-surface)] border-[var(--theme-border)]"
            value={status ?? 'active'}
            onChange={(e) => { setPage(1); setStatus(e.target.value as ListVendorProductsParams['status']); }}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 ml-auto">
          <span className="text-sm">Sort</span>
          <select
            aria-label="Sort products"
            className="rounded-xl border px-3 py-2 bg-[var(--theme-surface)] border-[var(--theme-border)]"
            value={sort ?? 'newest'}
            onChange={(e) => { setPage(1); setSort(e.target.value as ListVendorProductsParams['sort']); }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </label>
      </div>

      {msg ? (
        <div
          className="px-4 py-2 border-t text-sm"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-error)' }}
          role="status"
          aria-live="polite"
        >
          {msg}
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={headerStyle}>
          <tr>
            <th className="px-4 py-3 text-left">Product</th>
            <th className="px-4 py-3 text-left">Price</th>
            <th className="px-4 py-3 text-left">Photos</th>
            <th className="px-4 py-3 text-left">On sale</th>
            <th className="px-4 py-3 text-left">Archived</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
          </thead>
          <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-[var(--theme-border)]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {p.primaryPhotoUrl ? (
                    <img
                      src={p.primaryPhotoUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="rounded-lg object-cover"
                      style={{ background: 'var(--theme-card)' }}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg" style={{ background: 'var(--theme-card)' }} />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.title}</div>
                    <div className="text-xs opacity-70">#{p.id}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{centsToUsd(p.priceCents)}</td>
              <td className="px-4 py-3">{p.photoCount ?? 0}</td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!p.onSale}
                    onChange={(e) => toggleOnSale(p, e.target.checked)}
                  />
                  <span>On sale</span>
                </label>
              </td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!p.archived}
                    onChange={(e) => toggleArchived(p, e.target.checked)}
                  />
                  <span>Archived</span>
                </label>
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/products/${p.id}/edit`}
                  className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center opacity-70" colSpan={6}>
                {status === 'archived' ? 'No archived products.' : 'No products found.'}
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>

      {/* Footer with pager & hint */}
      <div className="flex items-center justify-between p-4">
        <div className="text-xs opacity-70">
          Tip: Archive removes items from Active view. Switch “Show → Archived” to revive them.
        </div>
        <div className="inline-flex gap-2">
          <button
            type="button"
            className="inline-flex rounded-xl px-3 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            Prev
          </button>
          <button
            type="button"
            className="inline-flex rounded-xl px-3 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
