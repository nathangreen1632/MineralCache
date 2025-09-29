// Client/src/api/vendor.ts
import { get, put, post, del } from '../lib/api';

/* =========================
   LEGACY (kept for compatibility)
   ========================= */

export type VendorMe = {
  id: number;
  name: string;
  slug: string;
  status?: 'pending' | 'approved' | 'rejected';
};

// NOTE: Kept the original signature & shape so existing callers (e.g., VendorDashboard) keep working.
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
// Server route is mounted at /vendors/me (lib/api handles /api prefix).
export function getMyVendorFull() {
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
  // ✅ FIX: plural + scoped route
  return get<{ items: VendorProductRow[]; total: number }>(`/vendors/me/products${qs}`);
}

export function updateVendorProductFlags(
  productId: number,
  body: { onSale?: boolean; archived?: boolean }
) {
  // ✅ FIX: plural + scoped route
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

export function listVendorOrders(
  params: {
    /** Orders.status or special filter "shipped" (vendor-fulfilled). */
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
  const qs = `?${search.toString()}`;
  // ✅ FIX: plural + scoped route
  return get<{ items: VendorOrderListItem[]; total: number }>(`/vendors/me/orders${qs}`);
}

/* =========================
   PHOTOS (rewired to product-scoped /products/:id/images routes)
   ========================= */

export type ProductPhoto = {
  id: number;
  isPrimary: boolean;
  url320: string | null;
  url800: string | null;
  url1600: string | null;

  // extras used by PhotoCard/ProductPhotosTab
  url: string | null;        // generic fallback url for img src
  deletedAt: string | null;  // soft-delete marker (server may omit; default null)
  position: number;          // UI sort index (always provided by mapper)
};

/** List photos via product detail (expects server to include product.photos) */
export async function listProductPhotos(
  productId: number
): Promise<{ data: { items: ProductPhoto[] }; error?: string }> {
  try {
    // Server getProduct returns: { product: { photos: {id,isPrimary,url320,url800,url1600}[] } }
    const res = await get<{ product: { photos?: Partial<ProductPhoto>[] } }>(`/products/${productId}`);

    // Support ApiResult<T> or raw T
    const payload: any = (res as any)?.data ?? res;
    const photos: ProductPhoto[] = (payload?.product?.photos ?? []).map(
      (p: Partial<ProductPhoto>, idx: number): ProductPhoto => {
        const url = p.url1600 ?? p.url800 ?? p.url320 ?? p.url ?? null;
        return {
          id: Number(p.id!),
          isPrimary: Boolean(p.isPrimary),
          url320: (p.url320 ?? null) as any,
          url800: (p.url800 ?? null) as any,
          url1600: (p.url1600 ?? null) as any,
          url,                                // fallback used by PhotoCard
          deletedAt: (p as any).deletedAt ?? null,
          position: (p as any).position ?? idx, // ensure it's always a number
        };
      }
    );

    return { data: { items: photos } };
  } catch (e: any) {
    // Keep the shape consistent with your component’s destructure
    return { data: { items: [] }, error: e?.message ?? 'Failed to load photos' };
  }
}

/** Reorder photos by array of photo IDs (primary handled separately) */
export function reorderProductPhotos(productId: number, orderedIds: number[]) {
  return post<{ ok: true }, { order: number[] }>(`/products/${productId}/images/reorder`, {
    order: orderedIds,
  });
}

/** Mark a photo as primary */
export function setPrimaryProductPhoto(productId: number, photoId: number) {
  return post<{ ok: true }, {}>(`/products/${productId}/images/${photoId}/primary`, {});
}

/** Soft-delete a photo */
export function softDeleteProductPhoto(productId: number, photoId: number) {
  return del<{ ok: true }>(`/products/${productId}/images/${photoId}`);
}

/** Restore a previously soft-deleted photo */
export function restoreProductPhoto(productId: number, photoId: number) {
  return post<{ ok: true }, {}>(`/products/${productId}/images/${photoId}/restore`, {});
}

/* =========================
   PAYOUTS (NEW)
   ========================= */

export type VendorPayoutRow = {
  orderId: number;
  vendorId: number;
  paidAt: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
};

export async function getMyPayouts(params?: { start?: string; end?: string }) {
  const qs = new URLSearchParams();
  if (params?.start) qs.set('start', params.start);
  if (params?.end) qs.set('end', params.end);

  const r = await fetch(`/api/vendors/me/payouts${qs.toString() ? `?${qs}` : ''}`, {
    credentials: 'include',
  });

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
