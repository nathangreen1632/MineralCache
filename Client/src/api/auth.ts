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

// DOB-based verification used by /verify-age screen / banner.
// We transform {year,month,day} into the server schema: { dateOfBirth: ISO8601 }
export function verify18(d: { year: number; month: number; day: number }) {
  const { year, month, day } = d;
  const iso = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
  return post<Verify18Response, { dateOfBirth: string }>('/auth/verify-18', { dateOfBirth: iso });
}
