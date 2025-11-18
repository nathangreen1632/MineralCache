// Client/src/api/products.ts
import { get, post, patch } from '../lib/api';

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
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  sizeNote?: string | null;
  weightG?: number | null;
  weightCt?: number | null;
  fluorescence: FluorescenceInput;
  condition?: string | null;
  conditionNote?: string | null;
  provenanceNote?: string | null;
  provenanceTrail?: ProvenanceEntry[] | null;
  priceCents: number;
  salePriceCents?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  images?: string[];
};

export type Product = {
  id: number;
  vendorId: number;
  title: string;
  description: string | null;
  species: string;
  locality: string | null;
  synthetic: boolean;
  vendorSlug?: string | null;
  vendorName?: string | null;
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
  primaryImageUrl?: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  auctionId?: number | null;
  auctionStatus?: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled' | null;
};

export type ListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  vendorId?: number;
  vendorSlug?: string;
  species?: string;
  synthetic?: boolean;
  onSale?: boolean;
  priceMinCents?: number;
  priceMaxCents?: number;
  sizeMinCm?: number;
  sizeMaxCm?: number;
  fluorescence?: string;
  condition?: string;
  category?: string;
  categoryId?: number;
  priceMin?: number;
  priceMax?: number;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
};

export type ListResponse = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function createProduct(body: ProductInput) {
  return post<{ ok: true; id: number }, ProductInput>('/products', body);
}

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
  if (typeof q.q === 'string' && q.q.trim().length > 0) params.set('q', q.q.trim());
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
  if (q.category) params.set('category', q.category);
  if (typeof q.categoryId === 'number') params.set('categoryId', String(q.categoryId));
  if (typeof q.priceMin === 'number') params.set('priceMin', String(q.priceMin));
  if (typeof q.priceMax === 'number') params.set('priceMax', String(q.priceMax));
  if (q.sort) params.set('sort', q.sort);

  const qs = params.toString();
  return get<ListResponse>(`/products${qs ? `?${qs}` : ''}`);
}
