// Client/src/pages/VendorApply.tsx
import React, { useState } from 'react';
import { api } from '../lib/api';

export default function VendorApply(): React.ReactElement {
  const [form, setForm] = useState({ displayName: '', bio: '', logoUrl: '', country: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    const { data, error, status } = await api<{ ok: boolean; vendorId: number; status: string }>(
      '/vendors/apply',
      {
        method: 'POST',
        body: JSON.stringify({
          displayName: form.displayName,
          bio: form.bio || null,
          logoUrl: form.logoUrl || null,
          country: form.country || null,
        }),
      }
    );

    setBusy(false);

    if (error) {
      setMsg(status === 401 ? 'Please log in first.' : error);
      return;
    }
    setMsg(`Submitted! Status: ${data?.status}`);
  }

  return (
    <section className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
      <h1 className="text-2xl font-extrabold mb-4">Apply as a Vendor</h1>
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1">
          <span>Display name</span>
          <input
            name="displayName"
            value={form.displayName}
            onChange={onChange}
            className="border rounded px-3 py-2 bg-[var(--theme-card)] text-[var(--theme-text)]"
            required
          />
        </label>
        <label className="grid gap-1">
          <span>Bio</span>
          <textarea
            name="bio"
            value={form.bio}
            onChange={onChange}
            rows={5}
            className="border rounded px-3 py-2 bg-[var(--theme-card)] text-[var(--theme-text)]"
          />
        </label>
        <label className="grid gap-1">
          <span>Logo URL</span>
          <input
            name="logoUrl"
            value={form.logoUrl}
            onChange={onChange}
            className="border rounded px-3 py-2 bg-[var(--theme-card)] text-[var(--theme-text)]"
          />
        </label>
        <label className="grid gap-1">
          <span>Country (3-letter)</span>
          <input
            name="country"
            value={form.country}
            onChange={onChange}
            className="border rounded px-3 py-2 bg-[var(--theme-card)] text-[var(--theme-text)]"
          />
        </label>

        <button
          disabled={busy}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-70"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </section>
  );
}
