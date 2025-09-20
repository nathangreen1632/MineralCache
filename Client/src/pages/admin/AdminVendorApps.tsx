// Client/src/pages/AdminVendorApps.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Vendor = {
  id: number;
  userId: number;
  displayName: string;
  slug: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  logoUrl?: string | null;
  country?: string | null;
  createdAt?: string;
};

export default function AdminVendorApps(): React.ReactElement {
  const [items, setItems] = useState<Vendor[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    const { data, error } = await api<{ items: Vendor[]; total: number }>('/admin/vendor-apps');
    if (error) {
      setMsg(error);
      return;
    }
    if (data) {
      setItems(data.items);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id: number) {
    setMsg(null);
    const { data, error } = await api<{ ok: boolean; onboardingUrl?: string | null; enabled?: boolean; message?: string; warning?: string }>(`/admin/vendors/${id}/approve`, { method: 'PATCH' });
    if (error) {
      setMsg(error);
      return;
    }
    if (data?.onboardingUrl) {
      setMsg('Approved. Onboarding link created.');
    } else {
      const note = data?.message || data?.warning || 'Approved.';
      setMsg(note);
    }
    load();
  }

  async function reject(id: number) {
    setMsg(null);
    const { error } = await api<{ ok: boolean }>(`/admin/vendors/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'Not a fit at this time.' }),
    });
    if (error) {
      setMsg(error);
      return;
    }
    setMsg('Rejected.');
    load();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Vendor Applications</h1>
      {msg && <p className="mb-4 text-sm">{msg}</p>}
      <div className="grid gap-3">
        {items.map(v => (
          <div key={v.id} className="border rounded p-3 flex items-center gap-3">
            {v.logoUrl ? <img src={v.logoUrl} alt="" className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-gray-200 rounded" />}
            <div className="flex-1">
              <div className="font-medium">{v.displayName}</div>
              <div className="text-xs text-gray-500">Status: {v.approvalStatus}</div>
            </div>
            <button onClick={() => approve(v.id)} className="px-3 py-1 rounded bg-green-600 text-white">Approve</button>
            <button onClick={() => reject(v.id)} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-gray-500">No pending applications.</div>}
      </div>
    </div>
  );
}
