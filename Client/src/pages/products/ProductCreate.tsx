// Client/src/pages/products/ProductCreate.tsx
import React, { useState } from 'react';
import ProductForm from './ProductForm';
import { createProduct, uploadProductImages, type ProductInput } from '../../api/products';

export default function ProductCreate(): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(values: ProductInput, images: File[]) {
    setBusy(true);
    setMsg(null);
    try {
      // status isn’t used here — omit to avoid TS6133
      const { data, error } = await createProduct(values);
      if (error || !data?.ok) {
        setMsg(error || 'Failed to create product.');
        return;
      }
      const id = data.id;

      if (images.length) {
        const up = await uploadProductImages(id, images);
        if (!up.ok) {
          setMsg(up.data?.error || 'Product created, but image upload failed.');
          setBusy(false);
          return;
        }
      }

      setMsg('Product created successfully.');
      // TODO: redirect to product detail or vendor list page
      // window.location.assign(`/products/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--theme-text)]">New Product</h1>
      <ProductForm mode="create" onSubmit={onSubmit} busy={busy} serverMessage={msg} />
    </section>
  );
}
