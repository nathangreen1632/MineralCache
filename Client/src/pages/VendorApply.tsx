// Client/src/pages/VendorApply.tsx
import React, { useState } from 'react';
import { api } from '../lib/api';

export default function VendorApply(): React.ReactElement {
  const [form, setForm] = useState({ displayName: '', bio: '', logoUrl: '', country: '' });
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const { data, error } = await api<{ ok: boolean; vendorId: number; status: string }>('/vendors/apply', {
      method: 'POST',
      body: JSON.stringify({
        displayName: form.displayName,
        bio: form.bio || null,
        logoUrl: form.logoUrl || null,
        country: form.country || null,
      }),
    });
    if (error) {
      setMsg(error);
      return;
    }
    if (data) {
      setMsg(`Application saved. Status: ${data.status}`);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Apply to be a Vendor</h1>
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1">
          <span>Display Name</span>
          <input name="displayName" value={form.displayName} onChange={onChange} className="border p-2 rounded" required />
        </label>
        <label className="grid gap-1">
          <span>Bio</span>
          <textarea name="bio" value={form.bio} onChange={onChange} className="border p-2 rounded" rows={4} />
        </label>
        <label className="grid gap-1">
          <span>Logo URL</span>
          <input name="logoUrl" value={form.logoUrl} onChange={onChange} className="border p-2 rounded" />
        </label>
        <label className="grid gap-1">
          <span>Country (2-letter code)</span>
          <input name="country" value={form.country} onChange={onChange} className="border p-2 rounded" />
        </label>

        <button className="mt-2 px-4 py-2 rounded bg-black text-white">Submit</button>
      </form>
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </div>
  );
}
