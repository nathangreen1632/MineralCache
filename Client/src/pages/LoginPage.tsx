// Client/src/pages/LoginPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const login = useAuthStore((s) => s.login);
  const user  = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user?.id) navigate(next, { replace: true });
  }, [user?.id, next, navigate]);

  const canSubmit = useMemo(() => !busy && email.trim().length > 3 && password.length >= 8, [busy, email, password]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const ok = await login(email.trim().toLowerCase(), password);
    setBusy(false);
    if (!ok) {
      setError('Invalid email or password');
      return;
    }
    navigate(next, { replace: true });
  }, [canSubmit, email, password, login, navigate, next]);

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10"
         style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border shadow-xl p-6 md:p-8"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          boxShadow: '0 12px 40px var(--theme-shadow)',
        }}
        aria-labelledby="login-title"
      >
        <h1 id="login-title" className="text-2xl font-extrabold mb-1 text-center">Sign In</h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--theme-muted)' }}>
          Sign in to shop, manage orders, follow auctions, and access vendor tools if enabled.
        </p>

        <label className="block text-sm mb-1" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          className="w-full rounded-xl border px-3 py-2 mb-4 outline-none"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            background: 'var(--theme-textbox)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        />

        <label className="block text-sm mb-1" htmlFor="password">Password</label>
        <div className="relative mb-3">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="w-full rounded-xl border px-3 py-2 outline-none pr-12"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              background: 'var(--theme-textbox)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <p className="text-sm mb-3" role="alert" style={{ color: 'var(--theme-error)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl font-semibold px-4 py-2 disabled:opacity-60 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: 'var(--theme-button)',
            color: 'var(--theme-text-white)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-button)')}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/register?next=${encodeURIComponent(next)}`)}
            className="rounded-xl h-10 w-36 mt-12 px-3 py-2 font-semibold border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: 'var(--theme-button)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-white)',
            }}
          >
            Create Account
          </button>

          <button
            type="button"
            onClick={() => navigate(`/`)}
            className="rounded-xl h-10 w-36 mt-12 px-3 py-2 font-semibold border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: 'var(--theme-button)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-white)',
            }}
          >
            Back to Home
          </button>
        </div>

        <p className="mt-6 text-center text-[12px]" style={{ color: 'var(--theme-muted)' }}>
          By signing in you agree to our terms. This site uses cookies for session authentication.
        </p>
      </form>
    </div>
  );
}
