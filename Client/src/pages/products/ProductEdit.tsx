// Client/src/pages/products/ProductEdit.tsx
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ProductForm from './ProductForm';
import { getProduct, updateProduct, type ProductInput } from '../../api/products';
import { uploadProductImages } from '../../api/productImages';
import ImageDerivativesList from '../../components/products/ImageDerivativesList';
import type { UploadImagesResponse } from '../../types/productImages.types';
import { useParams } from 'react-router-dom';
import ProductPhotosTab from '../../components/products/ProductPhotosTab';

export default function ProductEdit(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [initial, setInitial] = useState<ProductInput | null>(null);

  // upload state + returned metadata (for derivative sizes UI)
  const [uploading, setUploading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<UploadImagesResponse | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      try {
        const { data, error } = await getProduct(id);
        if (!alive) return;

        if (error || !data?.product) {
          const em = error || 'Product not found.';
          setMsg(em);
          toast.error(em);
          return;
        }

        const p = data.product;
        const init: ProductInput = {
          title: p.title,
          description: p.description ?? null,
          species: p.species,
          locality: p.locality ?? null,
          synthetic: Boolean(p.synthetic),

          // dimensions + weight
          lengthCm: p.lengthCm ?? null,
          widthCm: p.widthCm ?? null,
          heightCm: p.heightCm ?? null,
          sizeNote: p.sizeNote ?? null,
          weightG: p.weightG ?? null,
          weightCt: p.weightCt ?? null,

          // fluorescence (structured)
          fluorescence: {
            mode: p.fluorescenceMode,
            colorNote: p.fluorescenceColorNote ?? null,
            wavelengthNm: p.fluorescenceWavelengthNm ?? null,
          },

          // condition + provenance
          condition: p.condition ?? null,
          conditionNote: p.conditionNote ?? null,
          provenanceNote: p.provenanceNote ?? null,
          provenanceTrail: p.provenanceTrail ?? null,

          // pricing (scheduled sale model)
          priceCents: p.priceCents,
          salePriceCents: p.salePriceCents ?? null,
          saleStartAt: p.saleStartAt ?? null,
          saleEndAt: p.saleEndAt ?? null,

          images: [],
        };

        setInitial(init);
      } catch (e: any) {
        const em = e?.message || 'Failed to load product.';
        setMsg(em);
        toast.error(em);
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
    setUploadMeta(null);

    try {
      const { data, error } = await updateProduct(id, values);
      if (error || !data?.ok) {
        const em = error || 'Failed to update product.';
        setMsg(em);
        toast.error(em);
        return;
      }

      if (images.length > 0) {
        setUploading(true);
        try {
          const res = await uploadProductImages(id, images);
          setUploadMeta(res);
          if (res.ok) {
            toast.success(`Uploaded ${res.received} new image${res.received === 1 ? '' : 's'}`);
          } else {
            toast.error('Images failed to upload.');
          }
        } catch (e: any) {
          toast.error(e?.message || 'Images failed to upload.');
        } finally {
          setUploading(false);
        }
      }

      setMsg('Product updated.');
      toast.success('Product updated!');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !initial) {
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
    <section className="mx-auto max-w-6xl px-6 py-14 grid gap-10">
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-[var(--theme-text)]">Edit Product</h1>
        <ProductForm
          mode="edit"
          initial={initial}
          onSubmit={onSubmit}
          busy={busy || uploading}
          serverMessage={msg}
        />
      </div>

      {/* Photos management (drag-reorder, set primary, delete/restore) */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--theme-text)]">Photos</h2>
        <div className="mt-3">
          <ProductPhotosTab productId={id} />
        </div>
      </section>

      {uploadMeta?.files?.length ? (
        <div className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
          <ImageDerivativesList files={uploadMeta.files} />
        </div>
      ) : null}
    </section>
  );
}
