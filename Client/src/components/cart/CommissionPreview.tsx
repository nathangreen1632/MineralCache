// Client/src/components/cart/CommissionPreview.tsx
import React, { useEffect, useState } from 'react';
import { getPublicConfig, type PublicConfig } from '../../api/public';
import { getCart } from '../../api/cart';
import { useAuthStore } from '../../stores/useAuthStore';

function usd(cents: number): string {
  let v = 0;
  if (Number.isFinite(cents)) v = cents;
  return `$${(v / 100).toFixed(2)}`;
}

export default function CommissionPreview(): React.ReactElement | null {
  const user = useAuthStore((s) => s.user);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      const isAuthed = !!user;
      let isPrivileged = false;
      if (user && user.role === 'admin') isPrivileged = true;

      if (!isAuthed || !isPrivileged) {
        if (alive) setLoaded(true);
        return;
      }

      const resCart = await getCart();
      let sub = 0;
      if (resCart?.data) {
        const data = resCart.data;
        if (data?.totals) {
          sub = data.totals.subtotal;
        }
      }
      if (alive) setSubtotal(sub);

      const resCfg = await getPublicConfig();
      if (alive) setConfig(resCfg);

      if (alive) setLoaded(true);
    }

    load();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) return null;
  if (user.role !== 'admin') return null;
  if (!loaded) return null;
  if (!config) return null;
  if (subtotal <= 0) return null;

  const bps = config.commissionBps;
  let est = Math.round((subtotal * bps) / 10000);
  if (est < config.minFeeCents) est = config.minFeeCents;

  return (
    <section
      className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 shadow-[0_10px_30px_var(--theme-shadow)]"
      aria-label="Commission preview"
      role="text"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Commission preview</h3>
        <span className="text-sm opacity-80">admin</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="opacity-80">Subtotal</div>
        <div className="text-right font-semibold">{usd(subtotal)}</div>
        <div className="opacity-80">Rate</div>
        <div className="text-right font-semibold">{(bps / 100).toFixed(2)}%</div>
        <div className="opacity-80">Minimum fee</div>
        <div className="text-right font-semibold">{usd(config.minFeeCents)}</div>
        <div className="opacity-80">Estimated commission</div>
        <div className="text-right font-bold">{usd(est)}</div>
      </div>
      <p className="mt-2 text-xs opacity-70">
        Estimate based on platform settings. Final fees may vary with vendor overrides.
      </p>
    </section>
  );
}
