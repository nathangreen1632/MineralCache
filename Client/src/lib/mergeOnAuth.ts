import { getGuestCart, clearGuestCart, type GuestCartItem } from './guestCart';
import { getCart, saveCart } from '../api/cart';
import { useAuthStore } from '../stores/useAuthStore';

async function mergeFlow(items: GuestCartItem[]) {
  try {
    const server = await getCart();
    const map = new Map<number, number>();
    const serverItems = Array.isArray((server as any)?.items) ? (server as any).items : [];
    for (const it of serverItems) {
      const pid = Number((it).productId);
      const qty = Number((it).quantity ?? (it).qty ?? 0);
      if (Number.isFinite(pid) && pid > 0 && Number.isFinite(qty) && qty > 0) map.set(pid, qty);
    }
    for (const it of items) {
      map.set(it.productId, (map.get(it.productId) ?? 0) + it.quantity);
    }
    const mergedItems = Array.from(map.entries()).map(([productId, quantity]) => ({ productId, quantity }));
    if (mergedItems.length > 0) {
      await saveCart({ items: mergedItems });
    }
  } finally {
    clearGuestCart();
  }
}

export function attachGuestCartMerge() {
  let prevUser = useAuthStore.getState().user;
  useAuthStore.subscribe((s) => {
    if (!prevUser && s.user) {
      const items = getGuestCart();
      if (items.length) {
        mergeFlow(items);
      }
    }
    prevUser = s.user;
  });
}
