// Client/src/api/search.ts
import { get } from '../lib/api';
import type { Product } from './products';

export type ProductSearchParams = {
  q: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc'| 'oldest';
  vendorId?: number;
  vendorSlug?: string;
};

export type ProductSearchResponse = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export function searchProducts(params: ProductSearchParams) {
  const qs = toQuery(params);
  return get<ProductSearchResponse>(`/search/products${qs}`);
}
