// Client/src/pages/AdminVendorApps.tsx
import React, { useEffect, useState } from 'react';
import { get, patch } from '../../lib/api';
import type { Ok } from '../../types/api.types';
import {type Vendor} from "../../types/adminVendorApps.types.ts";

export default function AdminVendorApps(): React.ReactElement {
  const [items, setItems] = useState<Vendor[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(): Promise<void> {
    setMsg(null);
    const { data, error, status } = await get<{ items: Vendor[]; total?: number }>(
      '/admin/vendor-apps'
    );
    if (error) {
      setMsg(status === 403 ? 'Admin only.' : error);
      return;
    }
    setItems(data?.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(id: number) {
    setMsg(null);
    setBusyId(id);
    const { data, error } = await patch<{
      ok: boolean;
      onboardingUrl?: string | null;
      enabled?: boolean;
      message?: string;
      warning?: string;
    }>(`/admin/vendors/${id}/approve`);
    setBusyId(null);

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
    await load();
  }

  async function reject(id: number) {
    setMsg(null);
    setBusyId(id);
    const { error } = await patch<Ok, { reason: string }>(
      `/admin/vendors/${id}/reject`,
      { reason: 'Not a fit at this time.' }
    );
    setBusyId(null);

    if (error) {
      setMsg(error);
      return;
    }
    setMsg('Rejected.');
    await load();
  }

  return (
    <section className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
      <h1 className="text-2xl font-extrabold mb-4">Vendor Applications</h1>
      {msg && <p className="mb-4 text-sm">{msg}</p>}

      <div className="grid gap-3">
        {items.map((v) => {
          const isBusy = busyId === v.id;
          return (
            <div
              key={v.id}
              className="rounded-2xl border bg-[var(--theme-card)] border-[var(--theme-border)] p-3 flex items-center gap-3"
            >
              {v.logoUrl ? (
                <img src={v.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--theme-surface)]" />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{v.displayName}</div>
                <div className="text-xs text-[var(--theme-muted)] truncate">/vendors/{v.slug}</div>
                <div className="text-xs text-[var(--theme-muted)]">Status: {v.approvalStatus}</div>
              </div>

              <button
                onClick={() => approve(v.id)}
                disabled={isBusy}
                className="inline-flex rounded-xl px-3 py-1 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] disabled:opacity-60"
              >
                {isBusy ? 'Working…' : 'Approve'}
              </button>
              <button
                onClick={() => reject(v.id)}
                disabled={isBusy}
                className="inline-flex rounded-xl px-3 py-1 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] disabled:opacity-60"
              >
                {isBusy ? 'Working…' : 'Reject'}
              </button>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-sm text-[var(--theme-muted)]">No pending applications.</div>
        )}
      </div>
    </section>
  );
}

