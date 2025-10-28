import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../../lib/api.ts';
import { useAuthStore } from '../../stores/useAuthStore.ts';
import LegalAgreementModal from '../../components/agreements/LegalAgreementModal.tsx';
import { getRequiredLegal, type LegalDoc } from '../../api/legal.ts';

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

  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [legalOpen, setLegalOpen] = useState(true);
  const [accepted, setAccepted] = useState<{ documentType: string; version: string }[] | null>(null);

  useEffect(() => {
    getRequiredLegal().then(setDocs).catch(() => setDocs([]));
  }, []);

  const canSubmit = useMemo(
    () =>
      name.trim().length >= 2 &&
      SAFE_EMAIL_RE.test(email.trim()) &&
      password.length >= 8 &&
      Boolean(accepted),
    [name, email, password.length, accepted]
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

    if (accepted && typeof window !== 'undefined') {
      window.localStorage.setItem('mc.pendingAgreements', JSON.stringify(accepted));
      window.localStorage.setItem('mc.legalOnboarded', '1');
    }

    await me();
    navigate(next, { replace: true });
  }, [canSubmit, busy, name, email, password, accepted, me, navigate, next]);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-14 bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-xl"
        aria-labelledby="register-title"
      >
        <h1 id="register-title" className="text-2xl text-center font-extrabold mb-4">Create your account</h1>

        {err && <div role="alert" className="mb-3 text-sm">⚠️ {err}</div>}

        <label htmlFor="name" className="block text-sm mb-1">Name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="John Doe"
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
          placeholder="email address"
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
          placeholder="at least 8 characters"
          className="mb-6 w-full rounded-xl border px-3 py-2"
          style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="mt-4 flex w-full items-center justify-between">
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            aria-disabled={!canSubmit || busy}
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => navigate(`/`)}
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            style={{
              background: 'var(--theme-button)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-white)',
            }}
          >
            Back to Home
          </button>
        </div>

        <p className="mt-3 text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            style={{
              background: 'var(--theme-button)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-white)',
            }}
          >
            Login
          </button>
        </p>
      </form>

      <LegalAgreementModal
        open={legalOpen}
        docs={docs}
        onClose={() => setLegalOpen(false)}
        onComplete={(a) => {
          setAccepted(a);
          setLegalOpen(false);
        }}
        title="Review and accept policies"
      />
    </div>
  );
}
