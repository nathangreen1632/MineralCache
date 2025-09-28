// Client/src/components/vendor/VendorProductsTable.tsx
import React, { useEffect, useState } from 'react';
import { listVendorProducts, setProductOnSale, setProductArchived, type VendorProductRow } from '../../api/vendor';
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

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await listVendorProducts(1, 100);
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || 'Failed to load products' });
        return;
      }
      setState({ kind: 'loaded', items: data.items ?? [], total: data.total ?? 0 });
    })();
    return () => { alive = false; };
  }, []);

  async function toggleOnSale(p: VendorProductRow, next: boolean) {
    if (state.kind !== 'loaded') return;
    setMsg(null);
    const prev = [...state.items];
    const local = state.items.map(i => i.id === p.id ? { ...i, onSale: next } : i);
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
    const prev = [...state.items];
    const local = state.items.map(i => i.id === p.id ? { ...i, archived: next } : i);
    setState({ kind: 'loaded', items: local, total: state.total });
    const { error } = await setProductArchived(p.id, next);
    if (error) {
      setMsg(error);
      setState({ kind: 'loaded', items: prev, total: state.total });
    }
  }

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

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

  return (
    <div className="rounded-2xl border" style={card}>
      {msg ? (
        <div className="px-4 py-2 border-b text-sm" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-error)' }}>
          {msg}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
          <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Photos</th>
            <th className="px-4 py-3">On sale</th>
            <th className="px-4 py-3">Archived</th>
            <th className="px-4 py-3"></th>
          </tr>
          </thead>
          <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-border)' }}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md overflow-hidden bg-[var(--theme-card)]">
                    {p.primaryPhotoUrl ? <img src={p.primaryPhotoUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
