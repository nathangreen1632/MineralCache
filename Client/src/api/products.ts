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

// ---------- NEW: list types ----------
export type ListQuery = {
  page?: number;
  pageSize?: number;
  vendorId?: number;
  vendorSlug?: string;
  species?: string;
  synthetic?: boolean;
  onSale?: boolean;
  minCents?: number;
  maxCents?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc';
};

export type ListResponse = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// Back-compat aliases (don’t break older imports)
export type ProductListParams = ListQuery;
export type ProductListResponse = ListResponse;

// ---------- Existing endpoints (kept) ----------
export async function createProduct(body: ProductInput) {
  return post<{ ok: true; id: number }, ProductInput>('/products', body);
}

export async function updateProduct(id: number, body: Partial<ProductInput>) {
  return patch<{ ok: true }, Partial<ProductInput>>(`/products/${id}`, body);
}

export async function getProduct(id: number) {
  return get<{ product: Product | null }>(`/products/${id}`);
}

// ---------- NEW: listProducts helper ----------
export async function listProducts(q: ListQuery = {}) {
  const params = new URLSearchParams();

  if (typeof q.page === 'number' && q.page > 0) params.set('page', String(q.page));
  if (typeof q.pageSize === 'number' && q.pageSize > 0) params.set('pageSize', String(q.pageSize));
  if (typeof q.vendorId === 'number') params.set('vendorId', String(q.vendorId));
  if (q.vendorSlug) params.set('vendorSlug', q.vendorSlug);
  if (q.species) params.set('species', q.species);
  if (typeof q.synthetic === 'boolean') params.set('synthetic', String(q.synthetic));
  if (typeof q.onSale === 'boolean') params.set('onSale', String(q.onSale));
  if (typeof q.minCents === 'number' && Number.isFinite(q.minCents)) {
    params.set('minCents', String(q.minCents));
  }
  if (typeof q.maxCents === 'number' && Number.isFinite(q.maxCents)) {
    params.set('maxCents', String(q.maxCents));
  }
  if (q.sort) params.set('sort', q.sort);

  const qs = params.toString();
  return get<ListResponse>(`/products${qs ? `?${qs}` : ''}`);
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
