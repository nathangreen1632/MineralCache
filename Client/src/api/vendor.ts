// Client/src/api/vendor.ts
import { get, put, post, del } from '../lib/api';

function unwrap<T>(res: any): T {
  const raw = res?.data ?? res;
  return (Array.isArray(raw) ? raw[0] : raw) as T;
}

function unwrapStrict<T>(res: any): NonNullable<T> {
  const value = unwrap<T>(res);
  if (value == null) throw new Error('Unexpected empty response');
  return value;
}

export type VendorApprovalStatus = 'pending' | 'approved' | 'rejected';

export type VendorMeResponse = {
  vendor: {
    id: number;
    userId: number;
    displayName: string;
    slug: string;
    bio: string | null;
    logoUrl: string | null;
    country: string | null;
    approvalStatus: VendorApprovalStatus;
    rejectedReason?: string | null;
    stripeAccountId?: string | null;
  } | null;
};

export type Vendor = NonNullable<VendorMeResponse['vendor']>;

export type StripeOnboardingResponse =
  | { onboardingUrl: string; enabled: true }
  | { onboardingUrl: null; enabled: false; message?: string }
  | { onboardingUrl: null; enabled: true; error: string };

export function getMyVendorFull() {
  return get<VendorMeResponse>('/vendors/me');
}

export function createStripeOnboardingLink() {
  return post<StripeOnboardingResponse, {}>('/vendors/me/stripe/link', {});
}

export async function applyVendor(body: {
  displayName: string;
  bio?: string | null;
  logoUrl?: string | null;
  country?: string | null;
}): Promise<
  | { ok: true; vendorId: number; status: VendorApprovalStatus }
  | {
  ok: false;
  code?: 'SLUG_TAKEN' | 'DISPLAY_NAME_TAKEN';
  message?: string;
  suggestions?: string[];
  error?: string;
}
> {
  const res = await post<
    | { ok: true; vendorId: number; status: VendorApprovalStatus }
    | {
    ok: false;
    code?: 'SLUG_TAKEN' | 'DISPLAY_NAME_TAKEN';
    message?: string;
    suggestions?: string[];
    error?: string;
  },
    typeof body
  >('/vendors/apply', body);

  if ((res as any)?.error) throw new Error((res as any).error);

  return unwrapStrict(res);
}

export type VendorApp = Vendor & {
  createdAt?: string;
  updatedAt?: string;
};

export function listVendorApps(params: {
  page?: number;
  q?: string;
  status?: VendorApprovalStatus | 'all';
}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.q) search.set('q', params.q);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  const query = search.toString();
  const path = '/admin/vendor-apps' + (query ? `?${query}` : '');
  return get<{
    items: VendorApp[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>(path);
}

export async function approveVendor(id: number): Promise<{
  ok: boolean;
  error?: string;
  enabled?: boolean;
  onboardingUrl?: string | null;
  warning?: string;
}> {
  const res = await post<
    { ok: boolean; error?: string; enabled?: boolean; onboardingUrl?: string | null; warning?: string },
    {}
  >(`/admin/vendor-apps/${id}/approve`, {});
  if ((res as any)?.error) return { ok: false, error: (res as any).error };
  return unwrapStrict(res);
}

export async function rejectVendor(id: number, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await post<{ ok: boolean; error?: string }, { reason?: string }>(
    `/admin/vendor-apps/${id}/reject`,
    { reason }
  );
  if ((res as any)?.error) return { ok: false, error: (res as any).error };
  return unwrapStrict(res);
}

export type VendorProductRow = {
  id: number;
  title: string;
  priceCents: number;
  onSale: boolean;
  archived: boolean;
  primaryPhotoUrl?: string | null;
  photoCount?: number;
  createdAt: string;
  updatedAt: string;
};

export function listVendorProducts(page = 1, pageSize = 50) {
  const search = new URLSearchParams();
  search.set('page', String(page));
  search.set('pageSize', String(pageSize));
  const query = search.toString();
  return get<{ items: VendorProductRow[]; total: number }>(`/vendors/me/products?${query}`);
}

export function updateVendorProductFlags(
  productId: number,
  body: { onSale?: boolean; archived?: boolean }
) {
  return put<{ ok: true }, { onSale?: boolean; archived?: boolean }>(
    `/vendors/me/products/${productId}`,
    body
  );
}

export function setProductOnSale(productId: number, onSale: boolean) {
  return updateVendorProductFlags(productId, { onSale });
}

export function setProductArchived(productId: number, archived: boolean) {
  return updateVendorProductFlags(productId, { archived });
}

export type OrderStatus = 'pending_payment' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type VendorOrderListItem = {
  id: number;
  createdAt: string;
  status: OrderStatus;
  itemCount: number;
  totalCents: number;
};

export function listVendorOrders(
  params: {
    status?: OrderStatus | 'shipped';
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 50));
  const query = search.toString();
  const qs = query ? `?${query}` : '';
  return get<{ items: VendorOrderListItem[]; total: number }>(`/vendors/me/orders${qs}`);
}

export type ProductPhoto = {
  id: number;
  isPrimary: boolean;
  url320: string | null;
  url800: string | null;
  url1600: string | null;
  url: string | null;
  deletedAt: string | null;
  position: number;
};

export async function listProductPhotos(
  productId: number
): Promise<{ data: { items: ProductPhoto[] }; error?: string }> {
  try {
    const res = await get<{ product: { photos?: Partial<ProductPhoto>[] } }>(`/products/${productId}`);
    const payload: any = (res as any)?.data ?? res;
    const photos: ProductPhoto[] = (payload?.product?.photos ?? []).map(
      (p: Partial<ProductPhoto>, idx: number): ProductPhoto => {
        const url = p.url1600 ?? p.url800 ?? p.url320 ?? (p as any).url ?? null;
        return {
          id: Number(p.id!),
          isPrimary: Boolean(p.isPrimary),
          url320: (p.url320 ?? null) as any,
          url800: (p.url800 ?? null) as any,
          url1600: (p.url1600 ?? null) as any,
          url,
          deletedAt: (p as any).deletedAt ?? null,
          position: (p as any).position ?? idx,
        };
      }
    );

    return { data: { items: photos } };
  } catch (e: any) {
    return { data: { items: [] }, error: e?.message ?? 'Failed to load photos' };
  }
}

export function reorderProductPhotos(productId: number, orderedIds: number[]) {
  return post<{ ok: true }, { order: number[] }>(`/products/${productId}/images/reorder`, {
    order: orderedIds,
  });
}

export function setPrimaryProductPhoto(productId: number, photoId: number) {
  return post<{ ok: true }, {}>(`/products/${productId}/images/${photoId}/primary`, {});
}

export function softDeleteProductPhoto(productId: number, photoId: number) {
  return del<{ ok: true }>(`/products/${productId}/images/${photoId}`);
}

export function restoreProductPhoto(productId: number, photoId: number) {
  return post<{ ok: true }, {}>(`/products/${productId}/images/${photoId}/restore`, {});
}

export type VendorPayoutRow = {
  orderId: number;
  vendorId: number;
  paidAt: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
};

export async function getMyPayouts(params?: { start?: string; end?: string }) {
  const search = new URLSearchParams();
  if (params?.start) search.set('start', params.start);
  if (params?.end) search.set('end', params.end);

  const query = search.toString();
  const base = '/api/vendors/me/payouts';
  const qs = query ? '?' + query : '';
  const path = base + qs;

  const r = await fetch(path, { credentials: 'include' });

  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    return {
      ok: false as const,
      status: r.status,
      error: (body)?.error || 'Request failed',
    };
  }

  const data = await r.json();
  return { ok: true as const, data };
}

