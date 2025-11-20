import React, { useEffect, useMemo, useState } from 'react';
import { get } from '../../lib/api';
import type { ApiResult } from '../../types/api.types';
import { centsToUsd } from '../../utils/money.util';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

type PulsePoint = {
  date: string;
  value: number;
};

type AdminPulseRes = {
  ordersToday: number;
  ordersYesterday: number;
  gmvTodayCents: number;
  gmvYesterdayCents: number;
  activeAuctions: number;
  auctionsEndingSoon: number;
  newUsersToday: number;
  newUsersYesterday: number;
  ordersSeries?: PulsePoint[];
  gmvSeries?: PulsePoint[];
  newUsersSeries?: PulsePoint[];
  lateShipments: number;
  payoutsReadyCents: number;
  paymentIncidents: number;
  emailIncidents: number;
};

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; data: AdminPulseRes }
  | { kind: 'error'; message: string };

type TrendDir = 'up' | 'down' | 'flat';

type Trend = {
  dir: TrendDir;
  deltaPct: number | null;
};

type Kpi = {
  key: string;
  label: string;
  primary: string;
  secondary: string;
  series: number[];
  trend: Trend;
};

function normalizeSeries(points: PulsePoint[] | undefined | null): number[] {
  if (!points || points.length === 0) return [];
  return points.map((p) => (Number.isFinite(p.value) ? p.value : 0));
}

function computeTrend(current: number, previous: number): Trend {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return { dir: 'flat', deltaPct: null };
  }
  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) {
    return { dir: 'flat', deltaPct: 0 };
  }
  const pct = (diff / previous) * 100;
  if (diff > 0) {
    return { dir: 'up', deltaPct: pct };
  }
  return { dir: 'down', deltaPct: Math.abs(pct) };
}

type MiniSparklineProps = {
  values: number[];
  'aria-label'?: string;
};

function MiniSparkline({ values, 'aria-label': ariaLabel }: Readonly<MiniSparklineProps>): React.ReactElement {
  if (!values || values.length === 0) {
    return (
      <div
        className="h-10 w-full rounded-md opacity-40"
        style={{ background: 'var(--theme-card-alt)' }}
        aria-hidden="true"
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const normalized = values.map((v) => {
    if (!Number.isFinite(v)) return 0.5;
    if (range === 0) return 0.5;
    return (v - min) / range;
  });
  const count = normalized.length;
  const step = count > 1 ? 100 / (count - 1) : 0;

  let d = '';
  for (let i = 0; i < count; i += 1) {
    const x = step * i;
    const y = 36 - normalized[i] * 24;
    if (i === 0) {
      d += `M ${x} ${y}`;
    } else {
      d += ` L ${x} ${y}`;
    }
  }

  return (
    <svg
      role="text"
      aria-label={ariaLabel}
      viewBox="0 0 100 40"
      className="h-10 w-full"
      preserveAspectRatio="none"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

type TrendBadgeProps = {
  trend: Trend;
};

function TrendBadge({ trend }: Readonly<TrendBadgeProps>): React.ReactElement {
  let icon: React.ReactElement = <Minus className="h-3 w-3" aria-hidden="true" />;
  let text = 'Flat versus yesterday';

  if (trend.deltaPct == null) {
    icon = <Minus className="h-3 w-3" aria-hidden="true" />;
    text = 'No previous data';
  } else if (trend.dir === 'up') {
    const pct = Math.abs(Math.round(trend.deltaPct));
    icon = <ArrowUpRight className="h-3 w-3" aria-hidden="true" />;
    text = `${pct}% higher than yesterday`;
  } else if (trend.dir === 'down') {
    const pct = Math.abs(Math.round(trend.deltaPct));
    icon = <ArrowDownRight className="h-3 w-3" aria-hidden="true" />;
    text = `${pct}% lower than yesterday`;
  }

  return (
    <div className="mt-1 inline-flex items-center gap-1 text-xs opacity-80" aria-hidden="true">
      {icon}
      <span>{text}</span>
    </div>
  );
}

type StatusSeverity = 'ok' | 'warn' | 'error';

type StatusChipProps = {
  label: string;
  description: string;
  severity: StatusSeverity;
};

function StatusChip({ label, description, severity }: Readonly<StatusChipProps>): React.ReactElement {
  let bg = 'var(--theme-card-alt)';
  let text = 'var(--theme-text)';
  let border = 'var(--theme-border)';

  if (severity === 'warn') {
    bg = 'var(--theme-warning)';
    text = 'var(--theme-text)';
    border = 'var(--theme-border)';
  } else if (severity === 'error') {
    bg = 'var(--theme-error)';
    text = 'var(--theme-text-white)';
    border = 'var(--theme-error)';
  }

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-full border px-3 py-1 text-xs"
      style={{ background: bg, color: text, borderColor: border }}
      role="text"
    >
      <span className="font-semibold">{label}</span>
      <span className="opacity-90">{description}</span>
    </div>
  );
}

export default function AdminDashboardPage(): React.ReactElement {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ kind: 'loading' });
      const res: ApiResult<AdminPulseRes> = await get<AdminPulseRes>('/admin/pulse');
      if (!alive) return;
      if (res.error || !res.data) {
        setState({
          kind: 'error',
          message: res.error || 'Could not load admin dashboard.',
        });
        return;
      }
      setState({ kind: 'loaded', data: res.data });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pulse = state.kind === 'loaded' ? state.data : null;

  const kpis: Kpi[] = useMemo(() => {
    if (!pulse) return [];
    const ordersTrend = computeTrend(pulse.ordersToday, pulse.ordersYesterday);
    const gmvTrend = computeTrend(pulse.gmvTodayCents, pulse.gmvYesterdayCents);
    const usersTrend = computeTrend(pulse.newUsersToday, pulse.newUsersYesterday);

    const ordersSeries = normalizeSeries(pulse.ordersSeries);
    const gmvSeries = normalizeSeries(pulse.gmvSeries);
    const usersSeries = normalizeSeries(pulse.newUsersSeries);

    const out: Kpi[] = [];

    out.push({
      key: 'orders',
      label: 'Orders (last 24h)',
      primary: `${pulse.ordersToday}`,
      secondary: 'New orders placed',
      series: ordersSeries,
      trend: ordersTrend,
    });

    out.push({
      key: 'gmv',
      label: 'GMV (last 24h)',
      primary: centsToUsd(pulse.gmvTodayCents),
      secondary: 'Gross merchandise value',
      series: gmvSeries,
      trend: gmvTrend,
    });

    out.push({
      key: 'auctions',
      label: 'Auctions',
      primary: `${pulse.activeAuctions} live`,
      secondary:
        pulse.auctionsEndingSoon === 0
          ? 'No auctions ending soon'
          : `${pulse.auctionsEndingSoon} ending in 24h`,
      series: [],
      trend: { dir: 'flat', deltaPct: null },
    });

    out.push({
      key: 'users',
      label: 'New users (last 24h)',
      primary: `${pulse.newUsersToday}`,
      secondary: 'New registrations',
      series: usersSeries,
      trend: usersTrend,
    });

    return out;
  }, [pulse]);

  const hasShippingIssue = Boolean(pulse && pulse.lateShipments > 0);
  const hasPayoutsIssue = Boolean(pulse && pulse.payoutsReadyCents > 0);
  const hasPaymentIssue = Boolean(pulse && pulse.paymentIncidents > 0);
  const hasEmailIssue = Boolean(pulse && pulse.emailIncidents > 0);
  const hasAnyIssue = hasShippingIssue || hasPayoutsIssue || hasPaymentIssue || hasEmailIssue;

  let shippingDesc = 'On time';
  let shippingSeverity: StatusSeverity = 'ok';
  if (hasShippingIssue && pulse) {
    const n = pulse.lateShipments;
    const suffix = n === 1 ? '' : 's';
    shippingDesc = `${n} late shipment${suffix}`;
    shippingSeverity = 'warn';
  }

  let payoutsDesc = 'Up to date';
  let payoutsSeverity: StatusSeverity = 'ok';
  if (hasPayoutsIssue && pulse) {
    payoutsDesc = `${centsToUsd(pulse.payoutsReadyCents)} ready to pay out`;
    payoutsSeverity = 'warn';
  }

  let paymentsDesc = 'No recent incidents';
  let paymentsSeverity: StatusSeverity = 'ok';
  if (hasPaymentIssue && pulse) {
    const n = pulse.paymentIncidents;
    const suffix = n === 1 ? '' : 's';
    paymentsDesc = `${n} payment incident${suffix}`;
    paymentsSeverity = 'error';
  }

  let emailsDesc = 'Sending normally';
  let emailsSeverity: StatusSeverity = 'ok';
  if (hasEmailIssue && pulse) {
    const n = pulse.emailIncidents;
    const suffix = n === 1 ? '' : 's';
    emailsDesc = `${n} email issue${suffix}`;
    emailsSeverity = 'warn';
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-surface)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
    boxShadow: '0 3px 15px var(--theme-shadow)',
  };

  const innerCardStyle: React.CSSProperties = {
    background: 'var(--theme-card)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
  };

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <section className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <header className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-[var(--theme-link)]" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-semibold text-[var(--theme-text)]">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--theme-text)] opacity-80">
              High-level health of orders, auctions, and payouts.
            </p>
          </div>
        </header>
        <div className="rounded-2xl border p-6" style={cardStyle} aria-busy="true">
          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div
                className="h-4 w-32 rounded-md animate-pulse"
                style={{ background: 'var(--theme-card-alt)' }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-20 rounded-xl border animate-pulse" style={innerCardStyle} />
                <div className="h-20 rounded-xl border animate-pulse" style={innerCardStyle} />
                <div className="h-20 rounded-xl border animate-pulse" style={innerCardStyle} />
                <div className="h-20 rounded-xl border animate-pulse" style={innerCardStyle} />
              </div>
            </div>
            <div className="space-y-3">
              <div
                className="h-4 w-24 rounded-md animate-pulse"
                style={{ background: 'var(--theme-card-alt)' }}
              />
              <div className="h-8 w-full rounded-xl border animate-pulse" style={innerCardStyle} />
              <div className="h-8 w-full rounded-xl border animate-pulse" style={innerCardStyle} />
              <div className="h-8 w-full rounded-xl border animate-pulse" style={innerCardStyle} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <header className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-[var(--theme-link)]" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-semibold text-[var(--theme-text)]">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--theme-text)] opacity-80">
              High-level health of orders, auctions, and payouts.
            </p>
          </div>
        </header>
        <div
          className="rounded-2xl border p-6 flex items-center gap-3"
          style={cardStyle}
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-5 w-5 text-[var(--theme-error)]" aria-hidden="true" />
          <p className="text-sm">{state.message}</p>
        </div>
      </section>
    );
  }

  if (!pulse) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-[var(--theme-text)]">Admin Dashboard</h1>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-8xl px-6 py-10 space-y-6">
      <header className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-[var(--theme-link)]" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-semibold text-[var(--theme-text)]">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--theme-text)] opacity-80">
            High-level pulse of orders, auctions, users, and operations.
          </p>
        </div>
      </header>

      <div
        className="rounded-2xl border p-6 h-[35rem]"
        style={cardStyle}
        aria-label="Marketplace pulse"
        role="text"
      >
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] items-stretch">
          <div className="space-y-4 h-[32rem]" role="text" aria-label="Key marketplace metrics">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80">
                Last 24 hours
              </h2>
              <span className="text-xs opacity-70">Rolling 7-day trend</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {kpis.map((kpi) => (
                <div
                  key={kpi.key}
                  className="flex flex-col justify-between rounded-xl border px-4 py-3 h-57"
                  style={innerCardStyle}
                  role="text"
                  aria-label={kpi.label}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-80">{kpi.label}</p>
                      <p className="mt-1 text-xl font-semibold">{kpi.primary}</p>
                    </div>
                    <div className="ml-2 w-24">
                      <MiniSparkline
                        values={kpi.series}
                        aria-label={`${kpi.label} over the last 7 days`}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col">
                    <span className="text-xs opacity-80">{kpi.secondary}</span>
                    <TrendBadge trend={kpi.trend} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside
            className="flex flex-col justify-between gap-4 rounded-xl border p-4"
            style={innerCardStyle}
            role="text"
            aria-label="Operational status"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {hasAnyIssue ? (
                  <AlertCircle className="h-5 w-5 text-[var(--theme-warning)]" aria-hidden="true" />
                ) : (
                  <CheckCircle2
                    className="h-5 w-5 text-[var(--theme-success)]"
                    aria-hidden="true"
                  />
                )}
                <div className="flex flex-col">
                  <p className="text-sm font-semibold">
                    {hasAnyIssue ? 'Attention needed' : 'All clear'}
                  </p>
                  <p className="text-xs opacity-80">
                    {hasAnyIssue
                      ? 'Some areas need review.'
                      : 'Nothing urgent needs your attention.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2" aria-live="polite">
              <StatusChip
                label="Shipping"
                description={shippingDesc}
                severity={shippingSeverity}
              />
              <StatusChip
                label="Payouts"
                description={payoutsDesc}
                severity={payoutsSeverity}
              />
              <StatusChip
                label="Payments"
                description={paymentsDesc}
                severity={paymentsSeverity}
              />
              <StatusChip
                label="Emails"
                description={emailsDesc}
                severity={emailsSeverity}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
              <span>Quick links:</span>
              <a
                href="/admin/orders"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              >
                Orders
              </a>
              <a
                href="/admin/auctions"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              >
                Auctions
              </a>
              <a
                href="/admin/settings"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              >
                Settings
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
