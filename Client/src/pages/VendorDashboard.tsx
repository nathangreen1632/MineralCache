// Client/src/pages/VendorDashboard.tsx
import {useEffect, useMemo, useState} from 'react';
import {createStripeOnboardingLink, getMyVendor, type VendorMeResponse} from '../api/vendor';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; data: NonNullable<VendorMeResponse['vendor']> | null }
  | { kind: 'error'; message: string };

function statusBgVar(status: 'pending' | 'approved' | 'rejected'): string {
  if (status === 'approved') return 'var(--theme-success)';
  if (status === 'pending') return 'var(--theme-warning)';
  return 'var(--theme-error)';
}

function StatusChip({ status }: Readonly<{ status: 'pending' | 'approved' | 'rejected' }>) {
  const bgVar = statusBgVar(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
      style={{
        background: bgVar,
        color: 'var(--theme-text)',
        boxShadow: `0 0 0 1px ${bgVar} inset`,
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

export default function VendorDashboard() {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const vendor = state.kind === 'loaded' ? state.data : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      try {
        const res = await getMyVendor();
        if (!alive) return;
        setState({ kind: 'loaded', data: res.vendor ?? null });
      } catch (e: any) {
        const msg = e?.detail?.error || e?.message || 'Failed to load vendor';
        if (!alive) return;
        setState({ kind: 'error', message: String(msg) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const heading = useMemo(() => {
    if (state.kind === 'loaded' && vendor) return vendor.displayName || 'Vendor Dashboard';
    return 'Vendor Dashboard';
  }, [state, vendor]);

  async function handleStripeOnboarding() {
    setBusy(true);
    try {
      const res = await createStripeOnboardingLink();
      if (res.enabled && res.onboardingUrl) {
        window.location.assign(res.onboardingUrl);
        return;
      }
      if (!res.enabled) {
        alert(res.message ?? 'Stripe is not configured yet.');
        return;
      }
      // enabled but error
      alert((res as any).error ?? 'Unable to start onboarding.');
    } catch (e: any) {
      const msg = e?.detail?.error || e?.message || 'Onboarding failed';
      alert(String(msg));
    } finally {
      setBusy(false);
    }
  }

  // Common styles via CSS variables
  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-card)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
  };
  const altCardStyle: React.CSSProperties = {
    background: 'var(--theme-card-alt)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
  };
  const borderOnly: React.CSSProperties = { borderColor: 'var(--theme-border)' };
  const ctaPrimaryStyle: React.CSSProperties = {
    background: 'var(--theme-pill-green)',
    color: 'var(--theme-text)',
    boxShadow: `0 0 0 1px var(--theme-border) inset`,
  };
  const mutedText: React.CSSProperties = { color: 'var(--theme-text)' };
  const subtleText: React.CSSProperties = { color: 'var(--theme-link)' };

  // ---- Render states
  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4" style={mutedText}>
          {heading}
        </h1>
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 rounded" style={{ background: 'var(--theme-card-alt)' }} />
          <div className="h-28 rounded" style={{ background: 'var(--theme-card)' }} />
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4" style={mutedText}>
          {heading}
        </h1>
        <div className="rounded-md border p-4" style={{ ...cardStyle }}>
          <p style={{ color: 'var(--theme-error)' }}>{state.message}</p>
        </div>
      </div>
    );
  }

  // loaded
  if (!vendor) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold" style={mutedText}>
          {heading}
        </h1>
        <p className="text-sm" style={subtleText}>
          You don’t have a vendor profile yet.
        </p>
        <a
          href="/vendor/apply"
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-inset"
          style={{
            ...borderOnly,
            background: 'var(--theme-surface)',
            color: 'var(--theme-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-card-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-surface)')}
        >
          Apply to become a vendor
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={mutedText}>
            {vendor.displayName}
          </h1>
          <p className="text-sm" style={subtleText}>
            /{vendor.slug}
          </p>
        </div>
        <StatusChip status={vendor.approvalStatus} />
      </div>

      {/* Status panels */}
      {vendor.approvalStatus === 'pending' && (
        <div className="rounded-lg border p-4" style={altCardStyle}>
          <p style={mutedText}>
            Your application is <strong>pending</strong>. You’ll be notified once an admin approves it.
          </p>
        </div>
      )}

      {vendor.approvalStatus === 'rejected' && (
        <div className="rounded-lg border p-4" style={{ ...cardStyle }}>
          <p style={{ color: 'var(--theme-error)' }}>
            Your application was <strong>rejected</strong>.
            {vendor.rejectedReason ? (
              <>
                {' '}
                Reason: <em style={mutedText}>{vendor.rejectedReason}</em>
              </>
            ) : null}
          </p>
          <div className="mt-3">
            <a
              href="/vendor/apply"
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset"
              style={{
                ...borderOnly,
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-surface)')}
            >
              Update application
            </a>
          </div>
        </div>
      )}

      {vendor.approvalStatus === 'approved' && (
        <div className="rounded-lg border p-4 space-y-3" style={cardStyle}>
          <p style={mutedText}>
            You’re <strong>approved</strong>! Connect your Stripe account to start receiving payouts.
          </p>
          <div>
            <button
              type="button"
              onClick={handleStripeOnboarding}
              disabled={busy}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={ctaPrimaryStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-button-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-pill-green)')}
            >
              {busy ? 'Starting…' : 'Start Stripe Onboarding'}
            </button>
          </div>
        </div>
      )}

      {/* Shell sections we’ll flesh out in Week-3 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-xl border p-4" style={cardStyle}>
          <h2 className="mb-2 text-lg font-semibold" style={mutedText}>
            Listings
          </h2>
          <p className="text-sm" style={subtleText}>
            Quick links to create and manage products.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/products/new"
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold"
              style={{
                background: 'var(--theme-button)',
                color: 'var(--theme-text-white)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-button-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-button)')}
            >
              New Product
            </a>
            <a
              href="/vendor/products"
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset"
              style={{
                ...borderOnly,
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-surface)')}
            >
              Manage Products
            </a>
          </div>
        </section>

        <section className="rounded-xl border p-4" style={cardStyle}>
          <h2 className="mb-2 text-lg font-semibold" style={mutedText}>
            Orders
          </h2>
          <p className="text-sm" style={subtleText}>
            View recent orders once sales start rolling in.
          </p>
          <div className="mt-3">
            <a
              href="/vendor/orders"
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset"
              style={{
                ...borderOnly,
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-surface)')}
            >
              View Orders
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
