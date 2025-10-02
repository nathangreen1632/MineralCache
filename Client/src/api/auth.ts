// Client/src/api/auth.ts
import { get, post } from '../lib/api';

export type MeUser = {
  id: number;
  role: 'buyer' | 'vendor' | 'admin';
  dobVerified18: boolean;
  email?: string | null;
  vendorId?: number | null;
  createdAt: string;
};

export type Verify18Response = { ok: true };

export function getMe() {
  // Server returns the user object directly (not { user: ... })
  return get<MeUser>('/auth/me');
}

// DOB-based verification used by /verify-age screen
export function verify18(d: { year: number; month: number; day: number }) {
  return post<Verify18Response, { year: number; month: number; day: number }>('/auth/verify-18', d);
}
