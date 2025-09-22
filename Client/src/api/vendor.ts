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

export function getMyVendor(): Promise<VendorMeResponse> {
  return api<VendorMeResponse>('/api/vendor/me', { method: 'GET' });
}

export function createStripeOnboardingLink(): Promise<StripeOnboardingResponse> {
  return api<StripeOnboardingResponse>('/api/vendor/me/stripe/link', { method: 'POST' });
}
