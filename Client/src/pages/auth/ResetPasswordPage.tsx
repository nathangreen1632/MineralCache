import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api/auth';

export default function ResetPasswordPage(): React.ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initEmail = params.get('email') || '';
  const [email, setEmail] = useState(initEmail);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(
    () =>
      !busy &&
      email.trim().length > 3 &&
      code.length === 6 &&
      pw.length >= 8 &&
      pw2.length >= 8 &&
      pw === pw2,
    [busy, email, code, pw, pw2]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await resetPassword({ email: email.trim(), code: code.trim(), newPassword: pw });
      navigate('/login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-5xl px-6 py-14 grid gap-10">
        <form onSubmit={onSubmit} className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6" aria-label="Reset password">
          <h1 className="text-2xl font-bold mb-2">Reset password</h1>
          <div className="grid gap-3">
            <label htmlFor="email" className="text-sm">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2"
              required
              aria-required="true"
            />

            <label htmlFor="code length" className="text-sm">6-digit code</label>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 tracking-widest"
              required
              aria-required="true"
            />

            <label htmlFor="password" className="text-sm">New password</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 pr-20"
                required
                aria-required="true"
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>

            <label htmlFor="passwordConfirm" className="text-sm">Confirm new password</label>
            <div className="relative">
              <input
                id="passwordConfirm"
                type={showPw2 ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 pr-20"
                required
                aria-required="true"
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw2((v) => !v)}
                aria-label={showPw2 ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                {showPw2 ? 'Hide' : 'Show'}
              </button>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mx-auto mt-2 inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
