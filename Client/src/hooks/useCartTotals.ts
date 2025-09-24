import { useEffect, useState, useCallback } from 'react';
import { getCart } from '../api/cart';
import { on } from '../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../lib/events';

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; totalCents: number }
  | { kind: 'error'; message: string };

export function useCartTotals(): {
  state: Load;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<Load>({ kind: 'idle' });

  const refresh = useCallback(async () => {
    setState({ kind: 'loading' });
    const { data, error } = await getCart();
    if (error || !data) {
      setState({ kind: 'error', message: error || 'Failed to load cart' });
      return;
    }
    const totalCents = data.totals?.total ?? 0;
    setState({ kind: 'loaded', totalCents });
  }, []);

  useEffect(() => {
    let alive = true;

    // Initial load
    (async () => {
      if (!alive) return;
      await refresh();
    })();

    // Re-fetch on cart or shipping changes
    const offCart = on(EV_CART_CHANGED, async () => {
      if (!alive) return;
      await refresh();
    });
    const offShip = on(EV_SHIPPING_CHANGED, async () => {
      if (!alive) return;
      await refresh();
    });

    return () => {
      alive = false;
      offCart();
      offShip();
    };
  }, [refresh]);

  return { state, refresh };
}
