// Client/src/pages/admin/AdminSettings.tsx
import React, { useEffect, useState } from 'react';
import { getAdminSettings, updateAdminSettings, type AdminSettings } from '../../api/admin';
import { getHealth } from '../../api/health';

function centsToUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/** ===== Server DTO (what /admin/settings returns) ===== */
type ServerAdminSettingsDTO = {
  commission: {
    bps: number;            // e.g. 800 for 8%
    minFeeCents: number;    // e.g. 75
  };
  shippingDefaults: {
    flatCents: number;              // base per order
    perItemCents?: number | null;
    freeThresholdCents?: number | null;
    handlingCents?: number | null;
    currency: string;
  };
  stripeEnabled?: boolean;
  updatedAt?: string;
};

/** Map server DTO -> client form shape (AdminSettings) */
function fromServer(dto: ServerAdminSettingsDTO): AdminSettings {
  return {
    commissionPct: Math.round((dto.commission?.bps ?? 0) / 100), // 800 bps -> 8
    minFeeCents: dto.commission?.minFeeCents ?? 0,
    shippingDefaults: {
      baseCents: dto.shippingDefaults?.flatCents ?? 0,
      perItemCents: dto.shippingDefaults?.perItemCents ?? 0,
      freeThresholdCents: dto.shippingDefaults?.freeThresholdCents ?? 0,
    },
    stripeEnabled: !!dto.stripeEnabled,
  };
}

/** Map client form -> server PATCH payload */
function toServer(form: AdminSettings) {
  return {
    commissionBps: Math.round((form.commissionPct ?? 0) * 100), // 8 -> 800
    minFeeCents: form.minFeeCents ?? 0,
    shipFlatCents: form.shippingDefaults?.baseCents ?? 0,
    shipPerItemCents: form.shippingDefaults?.perItemCents ?? 0,
    shipFreeThresholdCents: form.shippingDefaults?.freeThresholdCents ?? 0,
    // keep currency/handling & other flags untouched unless you add fields to the UI
    stripeEnabled: form.stripeEnabled ?? undefined,
  };
}

export default function AdminSettings(): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<AdminSettings | null>(null);
  const [stripeInfo, setStripeInfo] = useState<{ enabled: boolean; ready: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, h] = await Promise.all([getAdminSettings(), getHealth()]);
      if (!alive) return;

      // getAdminSettings() is typed to AdminSettings, but the server actually returns the DTO.
      // Safely coerce and map here.
      const sPayload = (s as any)?.data as ServerAdminSettingsDTO | undefined;

      if (!sPayload) {
        setMsg((s as any)?.error ?? 'Failed to load settings.');
      } else {
        setForm(fromServer(sPayload));
      }

      if ((h as any).error || !h.data) {
        setStripeInfo({ enabled: false, ready: false });
      } else {
        setStripeInfo({ enabled: !!h.data.stripe.enabled, ready: !!h.data.stripe.ready });
      }
    })();
    return () => { alive = false; };
  }, []);

  function set<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) {
    if (!form) return;
    setForm({ ...form, [key]: value });
  }
  function setShip<K extends keyof NonNullable<AdminSettings['shippingDefaults']>>(key: K, value: any) {
    if (!form) return;
    setForm({
      ...form,
      shippingDefaults: { ...form.shippingDefaults, [key]: value },
    });
  }

  async function onSave() {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    const payload = toServer(form);
    const { error } = await updateAdminSettings(payload as any);
    setBusy(false);
    setMsg(error ?? 'Saved.');
  }

  const card = { background: 'var(--theme-surface)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' } as const;

  if (!form) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="h-24 animate-pulse rounded-2xl" style={{ background: 'var(--theme-card)' }} />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-10 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--theme-text)]">Admin · Settings</h1>

      {msg && (
        <div className="rounded-md border px-3 py-2 text-sm" style={card}>
          {msg}
        </div>
      )}

      <div className="rounded-2xl border p-4 grid gap-4" style={card}>
        <h2 className="font-semibold">Platform Fees</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <span className="text-xs opacity-70">Commission (%)</span>
            <input
              type="number"
              inputMode="decimal"
              value={String(form.commissionPct ?? 0)}
              onChange={(e) => set('commissionPct', Number(e.target.value))}
              className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
              style={{ borderColor: 'var(--theme-border)' }}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs opacity-70">Minimum Fee</span>
            <input
              type="number"
              inputMode="numeric"
              value={String(form.minFeeCents ?? 0)}
              onChange={(e) => set('minFeeCents', Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
              style={{ borderColor: 'var(--theme-border)' }}
            />
            <span className="text-xs opacity-70">= {centsToUsd(form.minFeeCents || 0)}</span>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border p-4 grid gap-4" style={card}>
        <h2 className="font-semibold">Shipping Defaults</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <span className="text-xs opacity-70">Base (per order)</span>
            <input
              type="number"
              inputMode="numeric"
              value={String(form.shippingDefaults.baseCents ?? 0)}
              onChange={(e) => setShip('baseCents', Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
              style={{ borderColor: 'var(--theme-border)' }}
            />
            <span className="text-xs opacity-70">= {centsToUsd(form.shippingDefaults.baseCents || 0)}</span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs opacity-70">Per-item (optional)</span>
            <input
              type="number"
              inputMode="numeric"
              value={String(form.shippingDefaults.perItemCents ?? 0)}
              onChange={(e) => setShip('perItemCents', Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
              style={{ borderColor: 'var(--theme-border)' }}
            />
            <span className="text-xs opacity-70">= {centsToUsd(form.shippingDefaults.perItemCents || 0)}</span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs opacity-70">Free threshold (optional)</span>
            <input
              type="number"
              inputMode="numeric"
              value={String(form.shippingDefaults.freeThresholdCents ?? 0)}
              onChange={(e) => setShip('freeThresholdCents', Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
              style={{ borderColor: 'var(--theme-border)' }}
            />
            <span className="text-xs opacity-70">= {centsToUsd(form.shippingDefaults.freeThresholdCents || 0)}</span>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border p-4 grid gap-2" style={card}>
        <h2 className="font-semibold">Stripe</h2>
        <div className="text-sm opacity-80">Enabled (settings): {String(!!form.stripeEnabled)}</div>
        <div className="text-sm opacity-80">Server readiness (/health): {stripeInfo ? (stripeInfo.ready ? 'ready' : 'not ready') : '—'}</div>
      </div>

      <div>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
        >
          {busy ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </section>
  );
}
