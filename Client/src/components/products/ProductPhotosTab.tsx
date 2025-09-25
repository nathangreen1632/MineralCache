// Client/src/components/products/ProductPhotosTab.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  listProductPhotos,
  reorderProductPhotos,
  setPrimaryProductPhoto,
  softDeleteProductPhoto,
  restoreProductPhoto,
  type ProductPhoto,
} from '../../api/vendor';
import PhotosBoard from './photos/PhotosBoard';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; photos: ProductPhoto[] }
  | { kind: 'error'; message: string };

export default function ProductPhotosTab({ productId }: Readonly<{ productId: number }>): React.ReactElement {
  const [state, setState] = useState<Load>({ kind: 'idle' });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const { data, error } = await listProductPhotos(productId);
      if (!alive) return;
      if (error || !data) {
        setState({ kind: 'error', message: error || 'Failed to load photos' });
        return;
      }
      const sorted = (data.items ?? []).slice().sort((a, b) => a.position - b.position);
      setState({ kind: 'loaded', photos: sorted });
    })();
    return () => { alive = false; };
  }, [productId]);

  const photos = useMemo(() => state.kind === 'loaded' ? state.photos : [], [state]);

  async function persistOrder() {
    if (state.kind !== 'loaded') return;
    setMsg(null);
    const ids = state.photos.map(p => p.id);
    const { error } = await reorderProductPhotos(productId, ids);
    if (error) setMsg(error);
  }

  async function makePrimary(photoId: number) {
    setMsg(null);
    const { error } = await setPrimaryProductPhoto(productId, photoId);
    if (error) return setMsg(error);
    if (state.kind === 'loaded') {
      setState({ kind: 'loaded', photos: state.photos.map(p => ({ ...p, isPrimary: p.id === photoId })) });
    }
  }

  async function toggleDelete(p: ProductPhoto) {
    setMsg(null);
    if (p.deletedAt) {
      const { error } = await restoreProductPhoto(productId, p.id);
      if (error) return setMsg(error);
      if (state.kind === 'loaded') {
        setState({ kind: 'loaded', photos: state.photos.map(x => x.id === p.id ? { ...x, deletedAt: null } : x) });
      }
    } else {
      const { error } = await softDeleteProductPhoto(productId, p.id);
      if (error) return setMsg(error);
      if (state.kind === 'loaded') {
        setState({ kind: 'loaded', photos: state.photos.map(x => x.id === p.id ? { ...x, deletedAt: new Date().toISOString() } : x) });
      }
    }
  }

  const card = { background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' } as const;

  if (state.kind === 'idle' || state.kind === 'loading') {
    return <div className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)' }} />;
  }
  if (state.kind === 'error') {
    return <div className="rounded-xl border p-4 text-sm" style={card}><span style={{ color: 'var(--theme-error)' }}>{state.message}</span></div>;
  }

  return (
    <div className="grid gap-4">
      {msg ? (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ ...card, color: 'var(--theme-error)' }}>
          {msg}
        </div>
      ) : null}

      <PhotosBoard
        photos={photos}
        onReorder={(next) => setState({ kind: 'loaded', photos: next })}
        onMakePrimary={makePrimary}
        onToggleDelete={toggleDelete}
      />

      <div>
        <button
          type="button"
          onClick={persistOrder}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)]"
        >
          Save order
        </button>
      </div>
    </div>
  );
}
