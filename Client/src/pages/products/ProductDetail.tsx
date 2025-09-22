import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, type Product } from '../../api/products';

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; product: Product }
  | { kind: 'error'; message: string };

export default function ProductDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    if (!id) return;
    setState({ kind: 'loading' });
    getProduct(Number(id))
      .then(({ data, error, status }) => {
        if (error || !data?.product) {
          setState({ kind: 'error', message: error || `Not found (${status})` });
          return;
        }
        setState({ kind: 'loaded', product: data.product });
      })
      .catch((e: any) => setState({ kind: 'error', message: e?.message || 'Failed to load product' }));
  }, [id]);

  const card = { background: 'var(--theme-card)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' };

  if (state.kind === 'loading' || state.kind === 'idle') {
    return <section className="mx-auto max-w-5xl px-4 py-8"><div className="h-60 rounded-xl animate-pulse" style={card} /></section>;
  }
  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-md border p-4 text-sm" style={card}>{state.message}</div>
      </section>
    );
  }

  const p = state.product;
  const priceBlock = p.onSale && p.compareAtCents
    ? (<><span className="line-through opacity-60 mr-2">{centsToUsd(p.compareAtCents)}</span><span>{centsToUsd(p.priceCents)}</span></>)
    : (<span>{centsToUsd(p.priceCents)}</span>);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-2" style={card}>
          {/* TODO(images): render product images gallery */}
          <div className="h-80 rounded bg-[var(--theme-card-alt)]" />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-[var(--theme-text)]">{p.title}</h1>
          <div className="text-lg">{priceBlock}</div>
          <div className="text-sm opacity-80">
            <div><strong>Species:</strong> {p.species}</div>
            {p.locality && <div><strong>Locality:</strong> {p.locality}</div>}
            {p.size && <div><strong>Size:</strong> {p.size}</div>}
            {p.weight && <div><strong>Weight:</strong> {p.weight}</div>}
            {p.fluorescence && <div><strong>Fluorescence:</strong> {p.fluorescence}</div>}
            {p.condition && <div><strong>Condition:</strong> {p.condition}</div>}
            {p.provenance && <div><strong>Provenance:</strong> {p.provenance}</div>}
            <div><strong>Synthetic:</strong> {p.synthetic ? 'Yes' : 'No'}</div>
          </div>
          <div className="pt-2">
            {/* TODO(cart): wire up add-to-cart */}
            <button
              type="button"
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
              onClick={() => alert('TODO: add to cart')}
            >
              Add to Cart
            </button>
          </div>
          <div>
            <Link to="/products" className="text-sm text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]">
              ← Back to catalog
            </Link>
          </div>
        </div>
      </div>

      {p.description && (
        <div className="rounded-xl border p-4" style={card}>
          <h2 className="mb-2 text-lg font-semibold">Description</h2>
          <p className="whitespace-pre-wrap text-sm opacity-90">{p.description}</p>
        </div>
      )}
    </section>
  );
}
