import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [confirm, setConfirm] = useState('');
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [legalOpen, setLegalOpen] = useState(true);
  const [accepted, setAccepted] = useState<{ documentType: string; version: string }[] | null>(null);

  useEffect(() => {
    getRequiredLegal().then(setDocs).catch(() => setDocs([]));
  }, []);

  const passwordsMatch = useMemo(() => confirm.length > 0 && password === confirm, [password, confirm]);

  const canSubmit = useMemo(
    () =>
      name.trim().length >= 2 &&
      SAFE_EMAIL_RE.test(email.trim()) &&
      password.length >= 8 &&
      passwordsMatch &&
      Boolean(accepted),
    [name, email, password.length, passwordsMatch, accepted]
  );

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr(null);

    const payload = { name: name.trim(), email: email.trim().toLowerCase(), password };
    const { error } = await post<{ id: number; email: string }, typeof payload>('/auth/register', payload);

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
    <div className="min-h-screen grid place-items-center px-4 py-10" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border shadow-xl p-6 md:p-8"
        style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', boxShadow: '0 12px 40px var(--theme-shadow)' }}
        aria-labelledby="register-title"
      >
        <h1 id="register-title" className="text-2xl font-extrabold mb-1 text-center">Create your account</h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--theme-muted)' }}>
          Create an account to shop, manage orders, follow auctions, and access vendor tools if enabled.
        </p>

        {err && (
          <p className="text-sm mb-3 text-center" role="alert" style={{ color: 'var(--theme-error)' }}>
            {err}
          </p>
        )}

        <label htmlFor="name" className="block text-sm mb-1">Name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="John Doe"
          className="w-full rounded-xl border px-3 py-2 mb-4 outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
        />

        <label htmlFor="email" className="block text-sm mb-1">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border px-3 py-2 mb-4 outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
        />

        <label htmlFor="password" className="block text-sm mb-1">Password</label>
        <div className="relative mb-4">
          <input
            id="password"
            type={showPw1 ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="at least 8 characters"
            className="w-full rounded-xl border px-3 py-2 outline-none pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          />
          <button
            type="button"
            aria-label={showPw1 ? 'Hide password' : 'Show password'}
            onClick={() => setShowPw1((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            {showPw1 ? 'Hide' : 'Show'}
          </button>
        </div>

        <label htmlFor="confirm" className="block text-sm mb-1">Confirm password</label>
        <div className="relative">
          <input
            id="confirm"
            type={showPw2 ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="re-enter password"
            className="w-full rounded-xl border px-3 py-2 outline-none pr-12"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ background: 'var(--theme-textbox)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
            aria-invalid={confirm.length > 0 && !passwordsMatch}
          />
          <button
            type="button"
            aria-label={showPw2 ? 'Hide password' : 'Show password'}
            onClick={() => setShowPw2((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            {showPw2 ? 'Hide' : 'Show'}
          </button>
        </div>

        {!passwordsMatch && confirm.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: 'var(--theme-error)' }}>
            Passwords do not match
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="mt-6 w-full rounded-xl font-semibold px-4 py-2 disabled:opacity-60 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-button)')}
          aria-disabled={!canSubmit || busy}
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <div className="mt-6 flex items-center justify-between text-center text-base">
          <Link
            to={`/login?next=${encodeURIComponent(next)}`}
            className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          >
            Login
          </Link>

          <Link
            to="/forgot-password"
            className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          >
            I forgot my password
          </Link>

          <Link
            to="/"
            className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          >
            Back to Home
          </Link>
        </div>

        <p className="mt-6 text-center text-[12px]" style={{ color: 'var(--theme-muted)' }}>
          By creating an account you agree to our terms. This site uses cookies for session authentication.
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
