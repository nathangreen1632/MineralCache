// Client/src/api/cart.ts
import { get, post, put } from '../lib/api';
import { emit } from '../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../lib/events';

export type CartItem = {
  productId: number;
  title: string;
  priceCents: number;
  qty?: number;
  quantity?: number;
  imageUrl?: string | null;
};

export type CartTotals = {
  subtotal: number;
  shipping: number;
  total: number;
};

export type CartResponse = {
  items: CartItem[];
  totals: CartTotals;
};

// 🔧 Server expects `quantity` on PUT
export type PutCartItem = { productId: number; quantity: number };
export type PutCartBody = { items: PutCartItem[] };

export type CheckoutResponse =
  | { clientSecret: string }
  | { error: string };

export type SetShippingRuleBody = {
  ruleId: number | string;
};

/* ───────────────── helpers: coerce/normalize ───────────────── */
function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}
function toInt(v: unknown): number | undefined {
  const n = toNum(v, NaN);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function pickImageUrl(a: any): string | null {
  const candidates = [
    a?.imageUrl,
    a?.photoUrl,
    a?.thumbnailUrl,
    a?.thumbUrl,
    a?.primaryImageUrl,
    a?.primaryPhotoUrl,
    a?.image,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return null;
}

function normalizeItem(raw: any): CartItem {
  const productId = toNum(raw?.productId ?? raw?.id ?? raw?.product_id, 0);
  const title = String(raw?.title ?? raw?.name ?? 'Untitled item');

  const priceCents = toNum(
    raw?.priceCents ??
    raw?.unitPriceCents ??
    raw?.unit_price_cents ??
    raw?.unitCents ??
    raw?.price,
    0
  );

  const q = toInt(raw?.quantity ?? raw?.qty);
  const qtySafe = q !== undefined ? Math.max(0, q) : undefined;

  return {
    productId,
    title,
    priceCents,
    qty: qtySafe,
    quantity: qtySafe,
    imageUrl: pickImageUrl(raw),
  };
}

function normalizeTotals(raw: any): CartTotals {
  return {
    subtotal: toNum(raw?.subtotal ?? raw?.subtotalCents, 0),
    shipping: toNum(raw?.shipping ?? raw?.shippingCents, 0),
    total: toNum(raw?.total ?? raw?.totalCents, 0),
  };
}

/* ───────────────── API ───────────────── */

// GET /api/cart  → normalize to our stable shape
export async function getCart() {
  const res = await get<any>('/cart');

  if (res?.data) {
    const raw = res.data;
    const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [];
    const totals = normalizeTotals(raw.totals ?? {});
    return { ...res, data: { items, totals } as CartResponse };
  }

  return res as { data: CartResponse | null; error?: string | null; status?: number };
}

// PUT /api/cart
export async function saveCart(body: PutCartBody) {
  const res = await put<{ ok: true }, PutCartBody>('/cart', body);
  if (!res.error) emit(EV_CART_CHANGED);
  return res;
}

// PATCH/PUT /api/cart/shipping-rule
export async function setCartShippingRule(ruleId: number | string) {
  const res = await put<{ ok: true }, SetShippingRuleBody>('/cart/shipping-rule', { ruleId });
  if (!res.error) emit(EV_SHIPPING_CHANGED, { ruleId });
  return res;
}

// POST /api/cart/checkout
export function startCheckout(amountCents: number) {
  return post<CheckoutResponse, { amountCents: number }>('/cart/checkout', { amountCents });
}

/**
 * Add-to-cart convenience:
 * - Loads current cart
 * - Merges/inserts using `quantity`
 * - Saves via saveCart (emits EV_CART_CHANGED)
 */
export async function addToCart(productId: number, addQty = 1) {
  const res = await getCart();
  const { data, error, status } = res as {
    data: CartResponse | null;
    error?: string | null;
    status?: number;
  };

  if (status === 401) return { data: null, error: 'AUTH_REQUIRED', status };
  if (error) return { data: null, error, status };

  const items: PutCartItem[] = [];
  if (data && Array.isArray(data.items)) {
    for (const it of data.items) {
      const pid = Number(it.productId);
      const qRaw = it.quantity ?? it.qty ?? 0;
      const qNum = Math.trunc(Number(qRaw));
      const safe = Number.isFinite(qNum) ? Math.max(0, qNum) : 0;
      items.push({ productId: pid, quantity: safe });
    }
  }

  const clamp = (n: number) => {
    const t = Math.trunc(Number(n));
    if (!Number.isFinite(t)) return 1;
    if (t < 1) return 1;
    if (t > 99) return 99;
    return t;
  };

  const idx = items.findIndex((it) => it.productId === productId);
  if (idx >= 0) items[idx] = { productId, quantity: clamp(items[idx].quantity + addQty) };
  else items.push({ productId, quantity: clamp(addQty) });

  return await saveCart({ items });
}

/** Remove a single product from the cart */
export async function removeFromCart(productId: number) {
  const res = await getCart();
  const { data, error, status } = res as {
    data: CartResponse | null;
    error?: string | null;
    status?: number;
  };

  if (status === 401) return { data: null, error: 'AUTH_REQUIRED', status };
  if (error || !data) return { data: null, error: error ?? 'LOAD_FAILED', status };

  const items = (data.items ?? [])
    .filter((it) => Number(it.productId) !== Number(productId))
    .map((it) => ({
      productId: Number(it.productId),
      quantity: Math.max(0, Math.trunc(Number(it.quantity ?? it.qty ?? 0))),
    }));

  return await saveCart({ items });
}

/** Remove all items */
export async function clearCart() {
  return await saveCart({ items: [] });
}
