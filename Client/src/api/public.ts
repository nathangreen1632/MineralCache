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

export async function getFeaturedPhotos(): Promise<string[]> {
  const { data, error } = await get<ListResponse<string[]>>('/public/featured-photos?primary=true&size=1600');
  if (error) throw new Error(error);
  return (data?.items ?? []).map((u) => String(u));
}

export async function getOnSaleProducts(): Promise<OnSaleProduct[]> {
  const { data, error } = await get<ListResponse<OnSaleProduct[]>>('/public/on-sale');
  if (error) throw new Error(error);
  return data?.items ?? [];
}
