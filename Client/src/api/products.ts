// Client/src/api/products.ts
import { get, post, patch } from '../lib/api';

/* ============================
   Types aligned to new schema
   ============================ */

export type FluorescenceMode = 'none' | 'SW' | 'LW' | 'both';

export type FluorescenceInput = {
  mode: FluorescenceMode;
  colorNote?: string | null;
  wavelengthNm?: number[] | null;
};

export type ProvenanceEntry = {
  owner: string;
  yearStart?: number;
  yearEnd?: number;
  note?: string;
};

export type ProductInput = {
  title: string;
  description?: string | null;

  species: string;
  locality?: string | null;
  synthetic?: boolean;

  // Dimensions + weight (structured)
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  sizeNote?: string | null;
  weightG?: number | null;
  weightCt?: number | null;

  // Structured fluorescence
  fluorescence: FluorescenceInput;

  // Condition + provenance
  condition?: string | null; // enum/string server-side
  conditionNote?: string | null;
  provenanceNote?: string | null;
  provenanceTrail?: ProvenanceEntry[] | null;

  // Pricing (scheduled sale model)
  priceCents: number;
  salePriceCents?: number | null;
  saleStartAt?: string | null; // ISO8601
  saleEndAt?: string | null;

  // Uploader plumbing placeholder (ignored by API for now)
  images?: string[];
};

// Server response shape (mirrors DB column names)
export type Product = {
  id: number;
  vendorId: number;

  title: string;
  description: string | null;

  species: string;
  locality: string | null;
  synthetic: boolean;

  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  sizeNote: string | null;

  weightG: number | null;
  weightCt: number | null;

  fluorescenceMode: FluorescenceMode;
  fluorescenceColorNote: string | null;
  fluorescenceWavelengthNm: number[] | null;

  condition: string | null;
  conditionNote: string | null;
  provenanceNote: string | null;
  provenanceTrail: ProvenanceEntry[] | null;

  priceCents: number;
  salePriceCents: number | null;
  saleStartAt: string | null;
  saleEndAt: string | null;

  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ============================
   List (new query params)
   ============================ */

export type ListQuery = {
  page?: number;
  pageSize?: number;
  vendorId?: number;
  vendorSlug?: string;
  species?: string;
  synthetic?: boolean;
  onSale?: boolean;

  // New unified filters
  priceMinCents?: number;
  priceMaxCents?: number;
  sizeMinCm?: number;
  sizeMaxCm?: number;
  fluorescence?: string; // comma list of modes: "SW,LW"
  condition?: string;    // comma list of statuses

  sort?: 'newest' | 'price_asc' | 'price_desc';
};

export type ListResponse = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// Back-compat aliases (if other files import these names)
export type ProductListParams = ListQuery;
export type ProductListResponse = ListResponse;

/* ============================
   API calls
   ============================ */

export async function createProduct(body: ProductInput) {
  return post<{ ok: true; id: number }, ProductInput>('/products', body);
}

// We send the full structured payload on edit (server accepts partials too)
export async function updateProduct(id: number, body: ProductInput) {
  return patch<{ ok: true }, ProductInput>(`/products/${id}`, body);
}

export async function getProduct(id: number) {
  return get<{ product: Product }>(`/products/${id}`);
}

export async function listProducts(q: ListQuery = {}) {
  const params = new URLSearchParams();

  if (typeof q.page === 'number' && q.page > 0) params.set('page', String(q.page));
  if (typeof q.pageSize === 'number' && q.pageSize > 0) params.set('pageSize', String(q.pageSize));
  if (typeof q.vendorId === 'number') params.set('vendorId', String(q.vendorId));
  if (q.vendorSlug) params.set('vendorSlug', q.vendorSlug);
  if (q.species) params.set('species', q.species);
  if (typeof q.synthetic === 'boolean') params.set('synthetic', String(q.synthetic));
  if (typeof q.onSale === 'boolean') params.set('onSale', String(q.onSale));

  if (typeof q.priceMinCents === 'number') params.set('priceMinCents', String(q.priceMinCents));
  if (typeof q.priceMaxCents === 'number') params.set('priceMaxCents', String(q.priceMaxCents));

  if (typeof q.sizeMinCm === 'number') params.set('sizeMinCm', String(q.sizeMinCm));
  if (typeof q.sizeMaxCm === 'number') params.set('sizeMaxCm', String(q.sizeMaxCm));

  if (q.fluorescence) params.set('fluorescence', q.fluorescence);
  if (q.condition) params.set('condition', q.condition);

  if (q.sort) params.set('sort', q.sort);

  const qs = params.toString();
  return get<ListResponse>(`/products${qs ? `?${qs}` : ''}`);
}

/* ============================
   Uploads (kept here)
   ============================ */

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
