// Client/src/utils/tracking.ts
export function trackingUrl(carrier?: string | null, tracking?: string | null): string | null {
  if (!carrier || !tracking) return null;
  const t = encodeURIComponent(tracking);
  switch (carrier.toLowerCase()) {
    case 'ups':
      return `https://www.ups.com/track?loc=en_US&tracknum=${t}`;
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    default:
      return null;
  }
}
