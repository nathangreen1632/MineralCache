// Client/src/components/MiniCart.tsx
import React, { useEffect, useState } from 'react';
import { getCart } from '../api/cart';

export default function MiniCart(): React.ReactElement {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await getCart();
      if (!alive) return;
      const qty = (data?.items ?? []).reduce((n, it) => n + Math.max(0, it.qty || 0), 0);
      setCount(qty);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <a
      href="/cart"
      className="inline-flex items-center rounded-lg px-3 py-1 text-sm font-semibold ring-1 ring-inset"
      style={{
        background: 'var(--theme-surface)',
        color: 'var(--theme-text)',
        borderColor: 'var(--theme-border)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-card-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-surface)')}
      aria-label="Open cart"
    >
      Cart{count != null ? <span className="ml-2 rounded px-2 py-0.5 text-xs" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>{count}</span> : null}
    </a>
  );
}
