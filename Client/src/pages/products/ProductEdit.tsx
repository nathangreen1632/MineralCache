// Client/src/pages/products/ProductEdit.tsx
import React, { useEffect, useState } from 'react';
import ProductForm from './ProductForm';
import { getProduct, updateProduct, uploadProductImages, type ProductInput } from '../../api/products';
import { useParams } from 'react-router-dom';

export default function ProductEdit(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [initial, setInitial] = useState<Partial<ProductInput> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      try {
        const { data, error } = await getProduct(id);
        if (!alive) return;
        if (error || !data?.product) {
          setMsg(error || 'Product not found.');
        } else {
          const p = data.product;
          setInitial({
            title: p.title,
            description: p.description ?? '',
            species: p.species,
            locality: p.locality ?? '',
            size: p.size ?? '',
            weight: p.weight ?? '',
            fluorescence: p.fluorescence ?? '',
            condition: p.condition ?? '',
            provenance: p.provenance ?? '',
            synthetic: Boolean(p.synthetic),
            onSale: Boolean(p.onSale),
            priceCents: p.priceCents,
            compareAtCents: p.compareAtCents ?? null,
          });
        }
      } finally {
        if (alive) {
          setBusy(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function onSubmit(values: ProductInput, images: File[]) {
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await updateProduct(id, values);
      if (error) {
        setMsg(error || 'Failed to save product.');
        return;
      }
      if (images.length) {
        const up = await uploadProductImages(id, images);
        if (!up.ok) {
          setMsg(up.data?.error || 'Saved, but image upload failed.');
          setBusy(false);
          return;
        }
      }
      setMsg('Saved.');
      // TODO: optionally redirect
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 rounded" style={{ background: 'var(--theme-card-alt)' }} />
          <div className="h-28 rounded" style={{ background: 'var(--theme-card)' }} />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--theme-text)]">Edit Product</h1>
      <ProductForm mode="edit" initial={initial} onSubmit={onSubmit} busy={busy} serverMessage={msg} />
    </section>
  );
}
