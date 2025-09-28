import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type VendorProduct = {
  id: number;
  title: string;
  priceCents: number;
  onSale?: boolean;
  salePriceCents?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  thumbnailUrl?: string | null;
  updatedAt?: string;
};

function centsToUsd(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? Math.max(0, Math.trunc(cents)) : 0;
  return `$${(n / 100).toFixed(2)}`;
}

export default function VendorProductsPage(): React.ReactElement {
  const [items, setItems] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/vendor/products');
        if (!res.ok) {
          throw new Error(`Failed to load: ${res.status}`);
        }
        const data = await res.json();
        // Expecting { items: VendorProduct[], total: number } or [] — handle both
        const list = Array.isArray(data) ? data : (data.items ?? []);
        if (isMounted) setItems(list as VendorProduct[]);
      } catch (e: any) {
        if (isMounted) setErr(e?.message || 'Error loading products');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My Products</h1>
          <Link
            to="/vendor/products/new"
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
          >
            Add Product
          </Link>
        </header>

        <div className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
          {loading && <p>Loading…</p>}
          {!loading && err && <p role="alert">Error: {err}</p>}

          {!loading && !err && items.length === 0 && (
            <p>No products yet. Click <span className="underline decoration-dotted text-[var(--theme-link)]">Add Product</span> to create one.</p>
          )}

          {!loading && !err && items.length > 0 && (
            <ul className="grid gap-4">
              {items.map(p => (
                <li key={p.id} className="grid gap-3 p-4 rounded-xl border border-[var(--theme-border)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <Link
                        to={`/vendor/products/${p.id}/edit`}
                        className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                      >
                        {p.title}
                      </Link>
                      <div className="text-sm opacity-80">
                        Price: {centsToUsd(p.onSale && p.salePriceCents ? p.salePriceCents : p.priceCents)}
                        {p.onSale && p.salePriceCents ? (
                          <span className="ml-2 line-through opacity-60">{centsToUsd(p.priceCents)}</span>
                        ) : null}
                      </div>
                      {p.updatedAt ? <div className="text-xs opacity-60">Updated {new Date(p.updatedAt).toLocaleString()}</div> : null}
                    </div>
                    {p.thumbnailUrl ? (
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg"
                        style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
