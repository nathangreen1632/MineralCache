// Client/src/pages/products/ProductDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, type Product } from '../../api/products';

function centsToUsd(cents: number | null | undefined): string {
  const v = Number.isFinite(cents) ? Number(cents) : 0;
  return `$${(v / 100).toFixed(2)}`;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; product: Product }
  | { kind: 'error'; message: string };

export default function ProductDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!Number.isFinite(pid) || pid <= 0) {
      setState({ kind: 'error', message: 'Invalid product id' });
      return;
    }
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      try {
        const { data, error, status } = await getProduct(pid);
        if (!alive) return;
        if (error || !data?.product) {
          setState({ kind: 'error', message: error || `Not found (${status})` });
          return;
        }
        setState({ kind: 'loaded', product: data.product });
      } catch (e: any) {
        if (!alive) return;
        setState({ kind: 'error', message: e?.message || 'Failed to load product' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [pid]);

  const card: React.CSSProperties = {
    background: 'var(--theme-card)',
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text)',
  };

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-64 rounded-lg animate-pulse" style={card} />
        <div className="mt-4 h-6 w-1/2 rounded animate-pulse" style={card} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div
          className="rounded-md border p-4 text-sm"
          style={{ ...card, background: 'var(--theme-card-alt)' }}
        >
          {state.message}
        </div>
      </section>
    );
  }

  const p = state.product;

  const priceEl =
    p.onSale && p.compareAtCents != null && p.compareAtCents > p.priceCents ? (
      <>
        <span className="line-through opacity-60 mr-2">{centsToUsd(p.compareAtCents)}</span>
        <span>{centsToUsd(p.priceCents)}</span>
      </>
    ) : (
      <span>{centsToUsd(p.priceCents)}</span>
    );

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border p-2" style={card}>
        {/* TODO(images): render product images gallery */}
        <div className="aspect-square w-full rounded bg-[var(--theme-card-alt)]" />
      </div>

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">{p.title}</h1>
        <div className="text-sm" style={{ color: 'var(--theme-link)' }}>
          {p.species}
          {p.locality ? ` · ${p.locality}` : ''}
        </div>

        <div className="text-xl font-bold text-[var(--theme-text)]">{priceEl}</div>

        {p.description && (
          <div className="whitespace-pre-wrap text-sm opacity-90 text-[var(--theme-text)]">
            {p.description}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="opacity-80">Size</dt>
          <dd>{p.size ?? '—'}</dd>
          <dt className="opacity-80">Weight</dt>
          <dd>{p.weight ?? '—'}</dd>
          <dt className="opacity-80">Fluorescence</dt>
          <dd>{p.fluorescence ?? '—'}</dd>
          <dt className="opacity-80">Condition</dt>
          <dd>{p.condition ?? '—'}</dd>
          <dt className="opacity-80">Provenance</dt>
          <dd>{p.provenance ?? '—'}</dd>
          <dt className="opacity-80">Synthetic</dt>
          <dd>{p.synthetic ? 'Yes' : 'No'}</dd>
        </dl>

        <div className="flex items-center gap-2">
          {/* TODO(cart): wire up add-to-cart */}
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
            onClick={() => alert('TODO: add to cart')}
          >
            Add to Cart
          </button>
          <Link
            to="/products"
            className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset"
            style={{
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }}
          >
            Back to catalog
          </Link>
        </div>
      </div>

      {p.description && (
        <div className="md:col-span-2 rounded-xl border p-4" style={card}>
          <h2 className="mb-2 text-lg font-semibold text-[var(--theme-text)]">Description</h2>
          <p className="whitespace-pre-wrap text-sm opacity-90">{p.description}</p>
        </div>
      )}
    </section>
  );
}
