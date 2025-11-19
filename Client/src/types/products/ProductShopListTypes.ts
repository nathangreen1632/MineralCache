import type { Product } from '../../api/products';

export type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
  kind: 'loaded';
  data: { items: Product[]; total: number; page: number; totalPages: number };
}
  | { kind: 'error'; message: string };

export type SortValue = 'newest' | 'price_asc' | 'price_desc';

export type FormState = {
  species: string;
  vendorSlug: string;
  onSale: boolean;
  synthetic: boolean;
  priceMinDollars: string;
  priceMaxDollars: string;
  sort: SortValue;
  pageSize: string;
};
