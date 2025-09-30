// Client/src/components/orders/ShippedBanner.tsx
import React from 'react';

type Props = {
  shippedAt: string | null | undefined; // ISO string
  orderId: number | string;
};

const lsKey = (id: number | string) => `order:${id}:dismissedShippedBanner`;

export default function ShippedBanner({ shippedAt, orderId }: Readonly<Props>) {
  const hasShipped = Boolean(shippedAt);

  // Hooks must run every render in the same order.
  const [hidden, setHidden] = React.useState<boolean>(true);

  // Initialize/refresh visibility whenever shipped state or order changes.
  React.useEffect(() => {
    if (!hasShipped) {
      setHidden(true);
      return;
    }
    try {
      const dismissed =
        typeof window !== 'undefined' &&
        window.localStorage.getItem(lsKey(orderId)) === '1';
      setHidden(Boolean(dismissed));
    } catch {
      setHidden(false);
    }
  }, [hasShipped, orderId]);

  if (!hasShipped || hidden) return null;

  const dt = new Date(shippedAt as string);
  const pretty = Number.isFinite(dt.getTime()) ? dt.toLocaleString() : null;

  const onDismiss = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(lsKey(orderId), '1');
      }
    } catch {}
    setHidden(true);
  };

  return (
    <div
      role="text"
      aria-live="polite"
      className="rounded-2xl border p-4"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
      data-testid="shipped-inline-banner"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: 'var(--theme-accent, #16a34a)' }} />
        <div className="grow">
          <div className="font-semibold">Shipped</div>
          <div className="text-sm opacity-90">
            Your item is on its way{pretty ? <> — shipped on {pretty}</> : null}. We’ll email tracking if provided.
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss shipped notice"
          className="shrink-0 rounded-md px-2 py-1 hover:bg-[var(--theme-surface)]"
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
