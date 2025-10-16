export type GuestCartItem = { productId: number; quantity: number };

const KEY = 'mc.guestcart.v1';

function read(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        productId: Number(x?.productId),
        quantity: Number(x?.quantity),
      }))
      .filter((x) => Number.isFinite(x.productId) && x.productId > 0 && Number.isFinite(x.quantity) && x.quantity > 0);
  } catch {
    return [];
  }
}

function write(items: GuestCartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getGuestCart(): GuestCartItem[] {
  return read();
}

export function clearGuestCart(): void {
  write([]);
}

export function addToGuestCart(productId: number, quantity = 1): void {
  const items = read();
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx >= 0) {
    const nextQty = items[idx].quantity + quantity;
    items[idx] = { productId, quantity: nextQty };
  } else {
    items.push({ productId, quantity });
  }
  write(items);
}

export function removeFromGuestCart(productId: number, quantity?: number): void {
  const items = read();
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx < 0) return;
  if (!quantity) {
    write(items.filter((i) => i.productId !== productId));
    return;
  }
  const nextQty = items[idx].quantity - quantity;
  if (nextQty <= 0) {
    write(items.filter((i) => i.productId !== productId));
  } else {
    items[idx] = { productId, quantity: nextQty };
    write(items);
  }
}
