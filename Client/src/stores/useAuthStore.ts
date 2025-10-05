import { create } from 'zustand';
import md5 from 'blueimp-md5';
import { api, post } from '../lib/api';

// ---- Types ----
export type SessionUser = {
  id: number;
  role: 'buyer' | 'vendor' | 'admin';
  dobVerified18: boolean;
  email?: string | null;
  name?: string | null;
  vendorId?: number | null;
};

type AuthState = {
  user: SessionUser | null;
  gravatarHash: string | null;

  setUser: (u: SessionUser | null) => void;
  me: () => Promise<void>;

  gravatarUrl: (
    size?: number,
    fallback?: 'identicon' | 'monsterid' | 'retro' | 'mp'
  ) => string | null;

  // stubs
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

// ---- Helpers ----
function displayNameFrom(u: SessionUser | null): string | null {
  if (!u) return null;

  const n = (u.name ?? '').trim();
  if (n) return n;

  const e = (u.email ?? '').trim();
  if (!e) return null;

  const local = e.includes('@') ? e.split('@')[0] : e;
  return local || null;
}

function emailHash(email?: string | null): string | null {
  const norm = (email ?? '').trim().toLowerCase();
  if (!norm) return null;
  try {
    return md5(norm);
  } catch {
    return null;
  }
}

// ---- Store ----
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  gravatarHash: null,

  setUser(u) {
    const name = displayNameFrom(u);
    set({ user: u ? { ...u, name } : null });
  },

  async me() {
    const { data } = await api<any>('/auth/me');

    // accept any of: { user }, { me }, or the object itself
    const raw = data ?? null;
    const u: SessionUser | null =
      (raw && (raw.user ?? raw.me ?? raw)) ? (raw.user ?? raw.me ?? raw) as SessionUser : null;

    const name = displayNameFrom(u);
    const gravatarHash = emailHash(u?.email);

    set({ user: u ? { ...u, name } : null, gravatarHash: gravatarHash ?? null });
  },

  gravatarUrl(size = 64, fallback = 'identicon') {
    const { gravatarHash } = get();
    const hash = gravatarHash ?? '00000000000000000000000000000000';
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${fallback}`;
  },

  async login(email, password) {
    const { error } = await post<{ ok: true }>('/auth/login', { email, password });
    if (error) return false;
    await get().me();
    return true;
  },

  async logout() {
    await post<{ ok: true }>('/auth/logout', {});
    set({ user: null, gravatarHash: null });
  },
}));
