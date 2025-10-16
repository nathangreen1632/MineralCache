import { get } from '../lib/api';

export type PublicProduct = {
  id: number;
  title: string;
  priceCents: number;
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
  thumbnailUrl?: string | null;
  photoUrl?: string | null;
};

export async function getPublicProductsByIds(ids: number[]): Promise<PublicProduct[]> {
  const uniq = Array.from(new Set(ids.filter((n) => Number.isFinite(n) && n > 0)));
  if (!uniq.length) return [];
  const qs = encodeURIComponent(uniq.join(','));
  const bulk = await get<any>(`/public/products?ids=${qs}`);
  if (!bulk.error && Array.isArray(bulk.data)) return bulk.data as PublicProduct[];

  const out: PublicProduct[] = [];
  for (const id of uniq) {
    const r = await get<any>(`/public/products/${id}`);
    if (!r.error && r.data) out.push(r.data as PublicProduct);
  }
  return out;
}
