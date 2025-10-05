// Client/src/utils/tracking.ts
export type ShipCarrier = 'usps' | 'ups' | 'fedex' | 'dhl' | 'other';

export const ALLOWED_CARRIERS: ShipCarrier[] = ['usps', 'ups', 'fedex', 'dhl', 'other'];

export function trackingUrl(carrier?: string | null, tracking?: string | null): string | null {
  if (!carrier || !tracking) return null;
  const c = carrier.toLowerCase().trim() as ShipCarrier;
  const t = encodeURIComponent(tracking.trim());

  switch (c) {
    case 'ups':
      return `https://www.ups.com/track?loc=en_US&tracknum=${t}`;
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case 'dhl':
      return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${t}`;
    default:
      return null; // 'other' or unknown → no deep link
  }
}
