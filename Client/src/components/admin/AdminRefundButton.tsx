import React, { useState } from 'react';
import { adminRefundOrder } from '../../api/orders';

export default function AdminRefundButton({ orderId, disabled }: Readonly<{ orderId: number; disabled?: boolean }>): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onRefund() {
    if (busy) return;
    setMsg(null);
    // simple confirm
    if (!confirm('Refund this order in full?')) return;

    setBusy(true);
    const r = await adminRefundOrder(orderId);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error || 'Failed to refund');
      return;
    }
    setMsg('Refund created.');
    // Up to the parent to refresh order status; this is a stateless button
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onRefund}
        disabled={!!disabled || busy}
        className="rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] disabled:opacity-50"
      >
        {busy ? 'Refunding…' : 'Refund Order'}
      </button>
      {msg && <div className="text-sm opacity-80">{msg}</div>}
    </div>
  );
}
