// Client/src/pages/vendor/VendorProductsPage.tsx
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
  primaryPhotoUrl?: string | null; // matches server field
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
    const ctrl = new AbortController();
    let isMounted = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const safeJson = async (res: Response) => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      };

      try {
        const res = await fetch('/api/vendors/me/products', {
          credentials: 'include',
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });

        const body = await safeJson(res);

        if (!res.ok) {
          const msg =
            (body && (body.error || body.message)) ||
            res.statusText ||
            `Request failed (${res.status})`;
          if (isMounted) {
            setErr(msg);
            setItems([]);
          }
          return; // graceful early exit; no throw
        }

        const list = Array.isArray(body) ? body : (body?.items ?? []);
        if (isMounted) setItems(list as VendorProduct[]);
      } catch (e: unknown) {
        if ((e as any)?.name === 'AbortError') return; // unmount
        const msg =
          (e as any)?.message ||
          'Network error while loading your products. Please try again.';
        if (isMounted) {
          setErr(msg);
          setItems([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })().catch(() => {
      // defensive: in case anything slipped past try/catch above
      if (!ctrl.signal.aborted && isMounted) {
        setErr('Unexpected error while loading your products.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      ctrl.abort();
    };
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

          {!loading && err && (
            <div
              role="alert"
              className="mb-4 rounded-md border px-3 py-2 text-sm"
              style={{
                background: 'var(--theme-card-alt)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            >
              {err}
            </div>
          )}

          {!loading && !err && items.length === 0 && (
            <p>
              No products yet. Click{' '}
              <span className="underline decoration-dotted text-[var(--theme-link)]">
                Add Product
              </span>{' '}
              to create one.
            </p>
          )}

          {!loading && !err && items.length > 0 && (
            <ul className="grid gap-4">
              {items.map((p) => {
                const effCents =
                  p.onSale && typeof p.salePriceCents === 'number'
                    ? p.salePriceCents
                    : p.priceCents;

                return (
                  <li
                    key={p.id}
                    className="grid gap-3 p-4 rounded-xl border border-[var(--theme-border)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid gap-1">
                        <Link
                          to={`/vendor/products/${p.id}/edit`}
                          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                        >
                          {p.title}
                        </Link>
                        <div className="text-sm opacity-80">
                          Price: {centsToUsd(effCents)}
                          {p.onSale && typeof p.salePriceCents === 'number' ? (
                            <span className="ml-2 line-through opacity-60">
                              {centsToUsd(p.priceCents)}
                            </span>
                          ) : null}
                        </div>
                        {p.updatedAt ? (
                          <div className="text-xs opacity-60">
                            Updated {new Date(p.updatedAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      {p.primaryPhotoUrl ? (
                        <img
                          src={p.primaryPhotoUrl}
                          alt=""
                          className="w-20 h-20 object-cover rounded-lg"
                          style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                          onError={(ev) => {
                            // hide broken image gracefully
                            ev.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
