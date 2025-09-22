// Client/src/api/vendor.ts
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    // Try to surface server JSON error shape; fallback to text
    let detail: unknown = null;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    throw Object.assign(new Error('Request failed'), { status: res.status, detail });
  }
  return res.json() as Promise<T>;
}

/* ---------------- Existing exports (kept) — just pointing to plural /vendors ---------------- */

export function getMyVendor(): Promise<VendorMeResponse> {
  // Server route is mounted at /api/vendors/me
  return api<VendorMeResponse>('/api/vendors/me', { method: 'GET' });
}

export function createStripeOnboardingLink(): Promise<StripeOnboardingResponse> {
  // Server route is /api/vendors/me/stripe/link
  return api<StripeOnboardingResponse>('/api/vendors/me/stripe/link', { method: 'POST' });
}

/* ---------------- New helpers you’ll need this week (non-breaking additions) ---------------- */

// Matches server ApplySchema shape
export function applyVendor(body: {
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
  return api('/api/vendors/apply', {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
}): Promise<{
  items: VendorApp[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const url = new URL('/api/admin/vendor-apps', window.location.origin);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.q) url.searchParams.set('q', params.q);
  if (params.status && params.status !== 'all') url.searchParams.set('status', params.status);
  // Strip origin for same-origin fetch
  const path = url.toString().replace(window.location.origin, '');
  return api(path, { method: 'GET' });
}

export function approveVendor(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  return api(`/api/admin/vendor-apps/${id}/approve`, { method: 'POST' });
}

export function rejectVendor(
  id: number,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return api(`/api/admin/vendor-apps/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
