// Client/src/api/auth.ts
import { get, post } from '../lib/api';

export type MeResponse = {
  user: {
    id: number;
    role: 'buyer' | 'vendor' | 'admin';
    dobVerified18: boolean;
    email?: string | null;
  } | null;
};

export type Verify18Response = { ok: true };

export function getMe() {
  return get<MeResponse>('/auth/me');
}

// Body kept for compatibility with your server validator.
// If your schema allows empty body, this still works.
export function verify18() {
  return post<Verify18Response, { confirm: true }>('/auth/verify-18', { confirm: true });
}
