// Client/src/components/auctions/AuctionActions.tsx
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { closeAuction, cancelAuction, type AuctionStatus } from '../../api/auctions';
import { useAuthStore } from '../../stores/useAuthStore';

type Props = {
  auction: {
    id: number;
    vendorId: number;
    status: AuctionStatus;
    endAt?: string | null;
  };
  // Optional: let parent refresh or patch local state after a change
  onStatusChange?: (next: AuctionStatus, meta?: { reason?: string }) => void;
  className?: string;
};

export default function AuctionActions({ auction, onStatusChange, className }: Readonly<Props>): React.ReactElement | null {
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<'close' | 'cancel' | null>(null);

  const canManage = useMemo(() => {
    if (!user) return false;
    const role = String(user.role ?? '');
    const isAdmin = role === 'admin' || role === 'owner' || role === 'superadmin';
    if (isAdmin) return true;
    const vId = Number(user.vendorId ?? 0);
    return Number.isFinite(vId) && vId > 0 && vId === auction.vendorId;
  }, [user, auction.vendorId]);

  const isFinal = auction.status === 'ended' || auction.status === 'canceled';
  let statusLabel: string | null = null;
  if (auction.status === 'ended') statusLabel = 'Auction Closed';
  else if (auction.status === 'canceled') statusLabel = 'Auction Canceled';

  // If user can't manage and it's not final, hide entirely (same behavior as before)
  if (!canManage && !isFinal) return null;

  // Close allowed when scheduled or live; Cancel allowed when draft/scheduled/live
  const allowClose = auction.status === 'scheduled' || auction.status === 'live';
  const allowCancel = auction.status === 'draft' || auction.status === 'scheduled' || auction.status === 'live';

  async function doClose() {
    if (!allowClose) return;
    const ok = window.confirm('Close this auction now? This will end bidding immediately.');
    if (!ok) return;

    setBusy('close');
    const res = await closeAuction(auction.id);
    setBusy(null);

    // unwrap ApiResult<T>
    const apiErr = (res as any)?.error;
    if (apiErr) {
      toast.error(`Close failed (${String(apiErr)})`);
      return;
    }
    const body = (res as any)?.data as { ok: boolean; code?: string; auction?: { status: AuctionStatus } };
    if (!body || !body.ok || !body.auction) {
      toast.error(`Close failed (${body?.code ?? 'ERROR'})`);
      return;
    }

    toast.success('Auction closed');
    if (onStatusChange) onStatusChange(body.auction.status, { reason: 'manual_close' });
  }

  async function doCancel() {
    if (!allowCancel) return;
    const ok = window.confirm('Cancel this auction? This will prevent any further bidding.');
    if (!ok) return;

    setBusy('cancel');
    const res = await cancelAuction(auction.id);
    setBusy(null);

    // unwrap ApiResult<T>
    const apiErr = (res as any)?.error;
    if (apiErr) {
      toast.error(`Cancel failed (${String(apiErr)})`);
      return;
    }
    const body = (res as any)?.data as { ok: boolean; code?: string; auction?: { status: AuctionStatus } };
    if (!body || !body.ok || !body.auction) {
      toast.error(`Cancel failed (${body?.code ?? 'ERROR'})`);
      return;
    }

    toast.success('Auction canceled');
    if (onStatusChange) onStatusChange(body.auction.status, { reason: 'vendor_or_admin_cancel' });
  }

  return (
    <div
      className={className}
      role="text"
      aria-label="Auction management actions"
    >
      {isFinal && statusLabel && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-lg font-semibold bg-[var(--theme-card)] text-[var(--theme-error)] border border-[var(--theme-border)]">
          {statusLabel}
        </span>
      )}

      {!isFinal && allowClose && (
        <button
          type="button"
          onClick={doClose}
          disabled={busy === 'close'}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60 disabled:cursor-not-allowed mr-3"
        >
          {busy === 'close' ? 'Closing…' : 'Close Auction'}
        </button>
      )}

      {!isFinal && allowCancel && (
        <button
          type="button"
          onClick={doCancel}
          disabled={busy === 'cancel'}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-surface)] border border-[var(--theme-border)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy === 'cancel' ? 'Canceling…' : 'Cancel Auction'}
        </button>
      )}
    </div>
  );
}
