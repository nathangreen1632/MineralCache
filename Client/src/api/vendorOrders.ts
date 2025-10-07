// Client/src/api/vendorOrders.ts
const BASE = '/api/vendor/orders';

export function buildPackingSlipUrl(orderId: number, itemIds?: number[]): string {
  const url = new URL(`${BASE}/${orderId}/packing-slip`, window.location.origin);
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    const filtered = itemIds.filter(n => Number.isFinite(n));
    if (filtered.length > 0) {
      url.searchParams.set('itemIds', filtered.join(','));
    }
  }
  return url.toString();
}
