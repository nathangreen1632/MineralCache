// Client/src/components/auctions/AuctionCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import Countdown from './Countdown';

function cents(v: number | null | undefined): string {
  let n = 0;
  if (typeof v === 'number' && Number.isFinite(v)) n = v;
  const dollars = (n / 100).toFixed(2);
  return `$${dollars}`;
}

type Props = Readonly<{
  id: number;
  title?: string | null;
  highBidCents: number | null;
  startingBidCents: number;
  endAt: string | Date | null;
  imageUrl?: string | null;       // NEW
  productTitle?: string | null;   // NEW (optional subtitle)
  // NEW (optional): pass to show "Closed"/"Canceled" pill
  status?: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled';
}>;

export default function AuctionCard(props: Props): React.ReactElement {
  const displayTitle =
    typeof props.title === 'string' && props.title.length > 0
      ? props.title
      : `Auction #${props.id}`;

  let display = props.startingBidCents;
  if (typeof props.highBidCents === 'number') {
    display = props.highBidCents;
  }

  const linkState = {
    imageUrl: props.imageUrl ?? null,
    productTitle: props.productTitle ?? (props.title || `Auction #${props.id}`),
  };

  // NEW: compute a label if this card is final
  let statusLabel: string | null = null;
  if (props.status === 'ended') statusLabel = 'Closed';
  else if (props.status === 'canceled') statusLabel = 'Canceled';

  return (
    <article
      className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 shadow-[0_10px_30px_var(--theme-shadow)] grid gap-3"
      aria-labelledby={`auction-${props.id}-title`}
    >
      {props.imageUrl && (
        <Link
          to={`/auctions/${props.id}`}
          state={linkState}
          className="block overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]"
          aria-label={`View ${displayTitle}`}
        >
          <img
            src={props.imageUrl}
            alt={props.productTitle ?? displayTitle}
            className="h-[25rem] w-full object-cover"
            loading="lazy"
          />
        </Link>
      )}

      <h3 id={`auction-${props.id}-title`} className="text-lg font-semibold">
        <Link
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
          to={`/auctions/${props.id}`}
          state={linkState}
        >
          {displayTitle}
        </Link>
      </h3>

      {/* NEW: status pill under the title (shown only when final) */}
      {statusLabel && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-[var(--theme-card)] border border-[var(--theme-border)]">
          {statusLabel}
        </span>
      )}

      {props.productTitle && (
        <div className="text-sm text-[var(--theme-muted)]">{props.productTitle}</div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--theme-text)]">
          Current: <strong>{cents(display)}</strong>
        </span>
        <Countdown endAt={props.endAt} />
      </div>

      <div className="flex justify-end">
        <Link
          to={`/auctions/${props.id}`}
          state={linkState}
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
          aria-label={`View details for ${displayTitle}`}
        >
          View
        </Link>
      </div>
    </article>
  );
}
