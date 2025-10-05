import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { post } from '../lib/api';
import { useAuthStore } from '../stores/useAuthStore';

// ✅ Safe, linear-time email check (anchored + bounded quantifiers)
const SAFE_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,63}$/;

export default function RegisterPage(): React.ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const me = useAuthStore((s) => s.me);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      name.trim().length >= 2 &&
      SAFE_EMAIL_RE.test(email.trim()) &&
      password.length >= 8,
    [name, email, password.length]
  );

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr(null);

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    };

    const { error } = await post<{ id: number; email: string }, typeof payload>(
      '/auth/register',
      payload
    );

    if (error) {
      setErr(error);
      setBusy(false);
      return;
    }

    await me(); // hydrate session (server set cookie)
    navigate(next, { replace: true });
  }, [canSubmit, busy, name, email, password, me, navigate]);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-14 bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-xl"
        aria-labelledby="register-title"
      >
        <h1 id="register-title" className="text-2xl font-extrabold mb-4">Create your account</h1>

        {err && <div role="alert" className="mb-3 text-sm">⚠️ {err}</div>}

        <label htmlFor="name" className="block text-sm mb-1">Name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className="mb-3 w-full rounded-xl border px-3 py-2"
          style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="email" className="block text-sm mb-1">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="mb-3 w-full rounded-xl border px-3 py-2"
          style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password" className="block text-sm mb-1">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="mb-6 w-full rounded-xl border px-3 py-2"
          style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
          aria-disabled={!canSubmit || busy}
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="mt-3 text-sm">
          Already have an account?{' '}
          <Link
            className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
            to={`/login?next=${encodeURIComponent(next)}`}
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
