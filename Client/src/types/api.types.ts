// Client/src/lib/api.types.ts
export type Ok = { ok: boolean };

export type ApiResult<T> = { data: T | null; error: string | null; status: number };

export type ApiInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: HeadersInit;
};

export type VendorApplyReq = {
  displayName: string;
  bio: string | null;
  logoUrl: string | null;
  country: string | null; // 2-letter code per your server
};

export type VendorApplyRes = {
  ok: boolean;
  vendorId: number;
  status: string; // 'pending' | 'approved' | 'rejected' if you want to narrow
};