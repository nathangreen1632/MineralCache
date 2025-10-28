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
  return get<MeUser>('/auth/me');
}

export function verify18(d: { year: number; month: number; day: number }) {
  const { year, month, day } = d;
  const iso = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
  return post<Verify18Response, { dateOfBirth: string }>('/auth/verify-18', { dateOfBirth: iso });
}

export function requestPasswordReset(email: string) {
  return post<{ ok: true }, { email: string }>('/auth/forgot-password', { email });
}

export function resetPassword(payload: { email: string; code: string; newPassword: string }) {
  return post<{ ok: true }, { email: string; code: string; newPassword: string }>('/auth/reset-password', payload);
}
