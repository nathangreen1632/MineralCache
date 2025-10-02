import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../../lib/api';

type DobForm = {
  year: string;
  month: string;
  day: string;
};

export default function AgeVerifyPage(): React.ReactElement {
  const [form, setForm] = useState<DobForm>({ year: '', month: '', day: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  function onChange<K extends keyof DobForm>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      // Send the DOB payload your server expects
      const y = parseInt(form.year, 10);
      const m = parseInt(form.month, 10);
      const d = parseInt(form.day, 10);

      // You originally normalize in the server; we still send raw parts.
      await post('/auth/verify-18', { year: y, month: m, day: d });

      navigate('/', { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        'Unable to verify age. Please check your date and try again.';
      setErr(String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
        <div className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6" style={{ boxShadow: '0 10px 30px var(--theme-shadow)' }}>
          <h1 className="text-2xl font-semibold mb-4">Verify your age</h1>
          <p className="mb-6">
            Enter your date of birth to confirm you are at least 18 years old.
          </p>

          <form onSubmit={onSubmit} className="grid gap-4 max-w-md">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="dob-month" className="block text-sm mb-1">Month</label>
                <input
                  id="dob-month"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-xl border px-3 py-2 bg-[var(--theme-surface)] border-[var(--theme-border)]"
                  placeholder="MM"
                  value={form.month}
                  onChange={(e) => onChange('month', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="dob-day" className="block text-sm mb-1">Day</label>
                <input
                  id="dob-day"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-xl border px-3 py-2 bg-[var(--theme-surface)] border-[var(--theme-border)]"
                  placeholder="DD"
                  value={form.day}
                  onChange={(e) => onChange('day', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="dob-year" className="block text-sm mb-1">Year</label>
                <input
                  id="dob-year"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-xl border px-3 py-2 bg-[var(--theme-surface)] border-[var(--theme-border)]"
                  placeholder="YYYY"
                  value={form.year}
                  onChange={(e) => onChange('year', e.target.value)}
                />
              </div>
            </div>

            {err && (
              <div role="alert" className="text-sm mt-1">
                {err === 'INVALID_DOB' && 'Please enter a valid date.'}
                {err === 'AGE_RESTRICTION' && 'You must be 18 or older to continue.'}
                {err !== 'INVALID_DOB' && err !== 'AGE_RESTRICTION' && err}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify'}
              </button>
              <a
                href="/"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              >
                Cancel
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
