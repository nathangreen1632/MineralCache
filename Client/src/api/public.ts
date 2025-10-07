// Client/src/api/public.ts
import { get } from '../lib/api';

export type OnSaleProduct = {
  id: number;
  slug?: string | null;
  name: string;               // Product.title (server maps)
  price: number;              // dollars
  salePrice?: number | null;  // dollars
  imageUrl?: string | null;   // /uploads/...
};

type ListResponse<T> = { items: T };

/* -------------------- NEW: Categories + Category Products -------------------- */

export type PublicCategory = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  homeOrder: number;
  imageKey?: string | null;
};

export async function listCategories(): Promise<PublicCategory[]> {
  const { data, error } = await get<PublicCategory[]>('/public/categories');
  if (error) throw new Error(error);
  return data ?? [];
}

export type ListProductsParams = {
  slug: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
  priceMin?: number;      // dollars
  priceMax?: number;      // dollars
  vendorId?: number;
  onSale?: boolean;
  q?: string;
};

export type ListProductsResponse<T = any> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listProductsByCategory<T = any>(
  params: ListProductsParams
): Promise<ListProductsResponse<T>> {
  const usp = new URLSearchParams();

  usp.set('category', params.slug);
  if (typeof params.page === 'number') usp.set('page', String(params.page));
  if (typeof params.pageSize === 'number') usp.set('pageSize', String(params.pageSize));
  if (params.sort) usp.set('sort', params.sort);
  if (typeof params.vendorId === 'number') usp.set('vendorId', String(params.vendorId));
  if (params.q) usp.set('q', params.q);

  // dollars -> cents; omit when not provided
  if (typeof params.priceMin === 'number') {
    usp.set('priceMinCents', String(Math.round(params.priceMin * 100)));
  }
  if (typeof params.priceMax === 'number') {
    usp.set('priceMaxCents', String(Math.round(params.priceMax * 100)));
  }

  // Only send onSale when TRUE (checkbox checked)
  if (params.onSale === true) usp.set('onSale', 'true');

  const { data, error } = await get<ListProductsResponse<T>>(
    `/public/products?${usp.toString()}`
  );
  if (error) throw new Error(error);
  return data as ListProductsResponse<T>;
}

/* -------------------- Existing helpers (kept) -------------------- */

export async function getFeaturedPhotos(): Promise<string[]> {
  const { data, error } = await get<ListResponse<string[]>>(
    '/public/featured-photos?primary=true&size=1600'
  );
  if (error) throw new Error(error);
  return (data?.items ?? []).map((u) => String(u));
}

/** Get on-sale products; optionally increase the server limit for paging on Home */
export async function getOnSaleProducts(opts?: { limit?: number }): Promise<OnSaleProduct[]> {
  const qs = opts?.limit ? `?limit=${encodeURIComponent(opts.limit)}` : '';
  const { data, error } = await get<ListResponse<OnSaleProduct[]>>(`/public/on-sale${qs}`);
  if (error) throw new Error(error);
  return data?.items ?? [];
}
