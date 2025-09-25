// Client/src/api/vendor.ts
import { get, put, post } from '../lib/api';

/* =========================
   LEGACY (kept for compatibility)
   ========================= */

export type VendorMe = {
  id: number;
  name: string;
  slug: string;
  status?: 'pending' | 'approved' | 'rejected';
};

// NOTE: Kept the original signature & shape so existing callers (e.g. VendorDashboard) keep working.
// Server route was previously mounted at /me/vendor.
export function getMyVendor() {
  return get<{ vendor: VendorMe | null }>('/me/vendor');
}

/* =========================
   NEW: Vendor profile + onboarding + applications
   ========================= */

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
    // timestamps present but not required here
  } | null;
};

// Reusable alias (built from your existing type, no breaking change)
export type Vendor = NonNullable<VendorMeResponse['vendor']>;

export type StripeOnboardingResponse =
  | { onboardingUrl: string; enabled: true }
  | { onboardingUrl: null; enabled: false; message?: string }
  | { onboardingUrl: null; enabled: true; error: string };

// If you need the FULL vendor record (new shape), use this.
export function getMyVendorFull() {
  // Server route is mounted at /vendors/me (no /api prefix; lib/api handles base)
  return get<VendorMeResponse>('/vendors/me');
}

export function createStripeOnboardingLink() {
  // Server route: /vendors/me/stripe/link
  return post<StripeOnboardingResponse, {}>('/vendors/me/stripe/link', {});
}

// Matches server ApplySchema shape
export function applyVendor(body: {
  displayName: string;
  bio?: string | null;
  logoUrl?: string | null;
  country?: string | null;
}) {
  return post<
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
}

/* -------- Admin: list / approve / reject vendor applications -------- */

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
  const qs = search.toString();
  const path = '/admin/vendor-apps' + (qs ? `?${qs}` : '');
  return get<{
    items: VendorApp[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>(path);
}

export function approveVendor(id: number) {
  return post<{ ok: true } | { ok: false; error: string }, {}>(
    `/admin/vendor-apps/${id}/approve`,
    {}
  );
}

export function rejectVendor(id: number, reason?: string) {
  return post<{ ok: true } | { ok: false; error: string }, { reason?: string }>(
    `/admin/vendor-apps/${id}/reject`,
    { reason }
  );
}

/* =========================
   PRODUCTS (kept)
   ========================= */

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
  const qs = `?page=${page}&pageSize=${pageSize}`;
  return get<{ items: VendorProductRow[]; total: number }>('/vendor/products' + qs);
}

export function updateVendorProductFlags(
  productId: number,
  body: { onSale?: boolean; archived?: boolean }
) {
  return put<{ ok: true }, { onSale?: boolean; archived?: boolean }>(
    `/vendor/products/${productId}`,
    body
  );
}

export function setProductOnSale(productId: number, onSale: boolean) {
  return updateVendorProductFlags(productId, { onSale });
}

export function setProductArchived(productId: number, archived: boolean) {
  return updateVendorProductFlags(productId, { archived });
}

/* =========================
   ORDERS (kept)
   ========================= */

export type OrderStatus = 'pending_payment' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type VendorOrderListItem = {
  id: number;
  createdAt: string;
  status: OrderStatus;
  itemCount: number;
  totalCents: number;
};

export function listVendorOrders(params: {
  status?: OrderStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 50));
  const qs = `?${search.toString()}`;
  return get<{ items: VendorOrderListItem[]; total: number }>('/vendor/orders' + qs);
}

/* =========================
   PHOTOS (kept)
   ========================= */

export type ProductPhoto = {
  id: number;
  position: number;
  isPrimary: boolean;
  deletedAt?: string | null;
  // derivative URLs if your server returns them
  url1600?: string | null;
  url800?: string | null;
  url320?: string | null;
  // fallback single url if derivatives not exposed
  url?: string | null;
};

export function listProductPhotos(productId: number) {
  return get<{ items: ProductPhoto[] }>(`/vendor/products/${productId}/photos`);
}

export function reorderProductPhotos(productId: number, photoIdsInOrder: number[]) {
  return put<{ ok: true }, { ids: number[] }>(
    `/vendor/products/${productId}/photos/reorder`,
    { ids: photoIdsInOrder }
  );
}

export function setPrimaryProductPhoto(productId: number, photoId: number) {
  return post<{ ok: true }, {}>(`/vendor/products/${productId}/photos/${photoId}/primary`, {});
}

export function softDeleteProductPhoto(productId: number, photoId: number) {
  return put<{ ok: true }, {}>(`/vendor/products/${productId}/photos/${photoId}/delete`, {});
}

export function restoreProductPhoto(productId: number, photoId: number) {
  return put<{ ok: true }, {}>(`/vendor/products/${productId}/photos/${photoId}/restore`, {});
}
