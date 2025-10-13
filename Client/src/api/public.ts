// Client/src/api/public.ts
import { get } from '../lib/api';

export type OnSaleProduct = {
  id: number;
  slug?: string | null;
  name: string;
  price: number;
  salePrice?: number | null;
  imageUrl?: string | null;
  vendorSlug?: string | null;
};

type ListResponse<T> = { items: T };

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
  priceMin?: number;
  priceMax?: number;
  vendorId?: number;
  onSale?: boolean;
  q?: string;
  species?: string;
  synthetic?: boolean;
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
  if (params.species) usp.set('species', params.species);
  if (typeof params.synthetic === 'boolean') usp.set('synthetic', String(params.synthetic));

  if (typeof params.priceMin === 'number') {
    usp.set('priceMinCents', String(Math.round(params.priceMin * 100)));
  }
  if (typeof params.priceMax === 'number') {
    usp.set('priceMaxCents', String(Math.round(params.priceMax * 100)));
  }

  if (params.onSale === true) usp.set('onSale', 'true');

  const { data, error } = await get<ListProductsResponse<T>>(
    `/public/products?${usp.toString()}`
  );
  if (error) throw new Error(error);
  return data as ListProductsResponse<T>;
}

export async function getFeaturedPhotos(): Promise<string[]> {
  const { data, error } = await get<ListResponse<string[]>>(
    '/public/featured-photos?primary=true&size=1600'
  );
  if (error) throw new Error(error);
  return (data?.items ?? []).map((u) => String(u));
}

export async function getOnSaleProducts(opts?: { limit?: number }): Promise<OnSaleProduct[]> {
  let qs = '';
  if (opts && typeof opts.limit === 'number') {
    qs = `?limit=${encodeURIComponent(opts.limit)}`;
  }
  const { data, error } = await get<ListResponse<OnSaleProduct[]>>(`/public/on-sale${qs}`);
  if (error) throw new Error(error);
  return data?.items ?? [];
}
