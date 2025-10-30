import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../../api/auth';

export default function ForgotPasswordPage(): React.ReactElement {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const canSubmit = useMemo(() => !busy && email.trim().length > 3, [busy, email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-5xl px-6 py-14 grid gap-10">
        <form onSubmit={onSubmit} className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6" aria-label="Forgot password">
          <h1 className="text-2xl font-bold mb-2">Forgot your password?</h1>
          {sent ? (
            <p className="mb-4">If the email exists, a 6-digit code was sent. Enter it on the next screen.</p>
          ) : (
            <p className="mb-4">Enter your account email and if one exists in our database, we'll send you a 6-digit code.</p>
          )}
          {!sent && (
            <div className="grid gap-3">
              <label htmlFor="email" className="text-sm">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2"
                required
                aria-required="true"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="justify-self-center inline-block rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </div>
          )}
          {sent && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/reset-password?email=' + encodeURIComponent(email))}
                className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
              >
                Enter code
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
