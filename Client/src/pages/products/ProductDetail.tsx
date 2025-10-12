// Client/src/pages/products/ProductDetail.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, type Product } from '../../api/products';
import ImageCarousel from '../../components/products/ImageCarousel';
import AuctionPanel from '../../components/auctions/AuctionPanel';
import { addToCart } from '../../api/cart';
import toast from 'react-hot-toast';

function centsToUsd(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? Math.max(0, Math.trunc(cents)) : 0;
  return `$${(n / 100).toFixed(2)}`;
}

function isSaleActive(p: Product, now = new Date()): boolean {
  if (p.salePriceCents == null) return false;
  const startOk = !p.saleStartAt || new Date(p.saleStartAt) <= now;
  const endOk = !p.saleEndAt || now <= new Date(p.saleEndAt);
  return startOk && endOk;
}

function effectivePriceCents(p: Product): number {
  if (isSaleActive(p)) return p.salePriceCents as number;
  return p.priceCents;
}

function sizeLabel(p: Product): string {
  const parts: string[] = [];
  if (p.lengthCm != null) parts.push(String(p.lengthCm));
  if (p.widthCm != null) parts.push(String(p.widthCm));
  if (p.heightCm != null) parts.push(String(p.heightCm));
  if (parts.length > 0) return `${parts.join(' × ')} cm`;
  if (p.sizeNote) return p.sizeNote;
  return '—';
}

function weightLabel(p: Product): string {
  if (p.weightG != null) return `${p.weightG} g`;
  if (p.weightCt != null) return `${p.weightCt} ct`;
  return '—';
}

function fluorescenceLabel(p: Product): string {
  if (!p.fluorescenceMode || p.fluorescenceMode === 'none') return '—';
  let out = p.fluorescenceMode;
  if (p.fluorescenceColorNote) out += ` (${p.fluorescenceColorNote})`;
  return out;
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
  const [adding, setAdding] = useState(false);

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

  const images: string[] = useMemo(() => {
    if (state.kind !== 'loaded') return [];
    const p: any = state.product;

    const fromArray =
      (Array.isArray(p.images) &&
        p.images
          .map((x: any) => x?.url1600 || x?.url800 || x?.url320 || x?.url)
          .filter(Boolean)) ||
      (Array.isArray(p.photos) &&
        p.photos
          .map((x: any) => x?.url1600 || x?.url800 || x?.url320 || x?.url)
          .filter(Boolean)) ||
      [];

    const singletons = [p.primaryImageUrl, p.imageUrl, p.mainImageUrl].filter(Boolean) as string[];
    return Array.from(new Set<string>([...singletons, ...fromArray]));
  }, [state]);

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

  const onSaleNow = isSaleActive(p);
  const effCents = effectivePriceCents(p);

  let priceEl: React.ReactNode = <span>{centsToUsd(effCents)}</span>;
  if (onSaleNow) {
    priceEl = (
      <>
        <span className="line-through opacity-60 mr-2">{centsToUsd(p.priceCents)}</span>
        <span>{centsToUsd(effCents)}</span>
      </>
    );
  }

  // Auctions: support optional panel if product exposes auctionId
  const auctionId =
    typeof (p as any).auctionId === 'number' && (p as any).auctionId > 0
      ? ((p as any).auctionId as number)
      : undefined;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 grid gap-6 lg:grid-cols-2">
      {/* Left: image carousel */}
      <ImageCarousel images={images} label="Product images" />

      {/* Right: details */}
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--theme-text)]">{p.title}</h1>
        <div className="text-sm" style={{ color: 'var(--theme-link)' }}>
          {p.species}
          {p.locality ? ` · ${p.locality}` : ''}
        </div>

        {(p as any).vendorSlug ? (
          <div className="text-xs opacity-70">
            <Link
              to={`/vendors/${(p as any).vendorSlug}`}
              className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link)]"
              aria-label={`View vendor storefront: ${(p as any).vendorSlug}`}
            >
              {(p as any).vendorSlug}
            </Link>
          </div>
        ) : null}

        <div className="text-xl font-bold text-[var(--theme-text)]">{priceEl}</div>

        {/* Auctions: render panel when auctionId is present */}
        {auctionId ? <AuctionPanel auctionId={auctionId} /> : null}

        {p.description && (
          <div className="whitespace-pre-wrap text-sm opacity-90 text-[var(--theme-text)]">
            {p.description}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="opacity-80">Size</dt>
          <dd>{sizeLabel(p)}</dd>
          <dt className="opacity-80">Weight</dt>
          <dd>{weightLabel(p)}</dd>
          <dt className="opacity-80">Condition</dt>
          <dd>{p.condition ?? '—'}</dd>
          <dt className="opacity-80">Provenance</dt>
          <dd>{p.provenanceNote ?? '—'}</dd>
          <dt className="opacity-80">Synthetic</dt>
          <dd>{p.synthetic ? 'Yes' : 'No'}</dd>
          <dt className="opacity-80">Fluorescence</dt>
          <dd>{fluorescenceLabel(p)}</dd>
        </dl>

        <div className="flex items-center gap-2">
          {/* Add to Cart */}
          <button
            type="button"
            aria-label="Add this item to your cart"
            aria-busy={adding ? 'true' : 'false'}
            disabled={adding}
            className="inline-flex rounded-xl px-4 py-2 font-semibold
                       bg-[var(--theme-button)] text-[var(--theme-text-white)]
                       hover:bg-[var(--theme-button-hover)]
                       focus-visible:ring-2 focus-visible:ring-offset-2
                       focus-visible:ring-[var(--theme-focus)]
                       focus-visible:ring-offset-[var(--theme-surface)]"
            onClick={async () => {
              try {
                setAdding(true);
                const r = await addToCart(pid, 1);
                if (r?.error === 'AUTH_REQUIRED') {
                  toast.error('Please log in to add items to your cart.');
                  return;
                }
                if (r?.error) {
                  toast.error(r.error || 'Could not add to cart.');
                  return;
                }
                toast.success('Added to cart');
              } catch {
                toast.error('Could not add to cart.');
              } finally {
                setAdding(false);
              }
            }}
          >
            {adding ? 'Adding…' : 'Add to Cart'}
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
        <div className="lg:col-span-2 rounded-xl border p-4" style={card}>
          <h2 className="mb-2 text-lg font-semibold text-[var(--theme-text)]">Description</h2>
          <p className="whitespace-pre-wrap text-sm opacity-90">{p.description}</p>
        </div>
      )}
    </section>
  );
}
