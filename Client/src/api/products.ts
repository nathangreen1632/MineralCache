// Client/src/api/products.ts
import { get, post, patch } from '../lib/api';

// ---- Types aligned with server product.schema.ts ----
export type ProductInput = {
  title: string;
  description?: string | null;
  species: string;
  locality?: string | null;
  size?: string | null;
  weight?: string | null;
  fluorescence?: string | null;
  condition?: string | null;
  provenance?: string | null;
  synthetic?: boolean;
  onSale?: boolean;
  priceCents: number;
  compareAtCents?: number | null;
};

export type Product = ProductInput & {
  id: number;
  vendorId: number;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function createProduct(body: ProductInput) {
  return post<{ ok: true; id: number }, ProductInput>('/products', body);
}

export async function updateProduct(id: number, body: Partial<ProductInput>) {
  return patch<{ ok: true }, Partial<ProductInput>>(`/products/${id}`, body);
}

export async function getProduct(id: number) {
  return get<{ product: Product | null }>(`/products/${id}`);
}

// NOTE: file upload needs FormData; we use fetch directly (not JSON helper)
export async function uploadProductImages(id: number, files: File[]) {
  const fd = new FormData();
  files.slice(0, 4).forEach((f) => fd.append('photos', f));
  const res = await fetch(`/api/products/${id}/images`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
