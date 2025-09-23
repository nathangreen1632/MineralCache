// Client/src/pages/products/ProductCreate.tsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import ProductForm from './ProductForm';
import { createProduct, type ProductInput } from '../../api/products';
import { uploadProductImages } from '../../api/productImages';
import ImageDerivativesList from '../../components/products/ImageDerivativesList';
import type { UploadImagesResponse } from '../../types/productImages.types';

export default function ProductCreate(): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // upload state + returned metadata (for derivative sizes UI)
  const [uploading, setUploading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<UploadImagesResponse | null>(null);

  async function handleUploadPhotos(productId: number, files: File[]) {
    try {
      setUploading(true);
      const res = await uploadProductImages(productId, files);
      setUploadMeta(res);

      if (res.ok) {
        toast.success(`Uploaded ${res.received} image${res.received === 1 ? '' : 's'}`);
      } else {
        toast.error('Image upload failed.');
      }
      return res.ok;
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: ProductInput, images: File[]) {
    setBusy(true);
    setMsg(null);
    setUploadMeta(null);

    try {
      const { data, error } = await createProduct(values);
      if (error || !data?.ok) {
        const em = error || 'Failed to create product.';
        setMsg(em);
        toast.error(em);
        return;
      }

      const id = data.id;

      if (images.length > 0) {
        const ok = await handleUploadPhotos(id, images);
        if (!ok) {
          const m = 'Product created, but image upload failed.';
          setMsg(m);
          toast.error(m);
          return;
        }
        setMsg('Product and images created successfully.');
        toast.success('Product and images created!');
      } else {
        setMsg('Product created successfully.');
        toast.success('Product created!');
      }

      // TODO: redirect to product detail or vendor list page
      // window.location.assign(`/products/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-[var(--theme-text)]">New Product</h1>
        <ProductForm
          mode="create"
          onSubmit={onSubmit}
          busy={busy || uploading}
          serverMessage={msg}
        />
      </div>

      {/* Derivative sizes UI after successful upload */}
      {uploadMeta?.files?.length ? (
        <div className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
          <ImageDerivativesList files={uploadMeta.files} />
        </div>
      ) : null}
    </section>
  );
}
