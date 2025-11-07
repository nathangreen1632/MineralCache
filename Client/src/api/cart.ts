// Client/src/api/cart.ts
import { get, post, put } from '../lib/api';
import { emit } from '../lib/eventBus';
import { EV_CART_CHANGED, EV_SHIPPING_CHANGED } from '../lib/events';
import { addToGuestCart, removeFromGuestCart, getGuestCart } from '../lib/guestCart';
import { getPublicProductsByIds } from './publicProducts';

export type CartItem = {
  productId: number;
  title: string;
  priceCents: number;
  qty?: number;
  quantity?: number;
  imageUrl?: string | null;
  vendorSlug?: string | null;
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

export type PutCartItem = { productId: number; quantity: number };
export type PutCartBody = { items: PutCartItem[] };

export type CheckoutResponse =
  | { clientSecret: string }
  | { error: string };

export type SetShippingRuleBody = {
  ruleId: number | string;
};

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
  const vendorSlug =
    raw?.vendorSlug ?? raw?.vendor_slug ?? raw?.vendor?.slug ?? null;

  return {
    productId,
    title,
    priceCents,
    qty: qtySafe,
    quantity: qtySafe,
    imageUrl: pickImageUrl(raw),
    vendorSlug,
  };
}


function normalizeTotals(raw: any): CartTotals {
  return {
    subtotal: toNum(raw?.subtotal ?? raw?.subtotalCents, 0),
    shipping: toNum(raw?.shipping ?? raw?.shippingCents, 0),
    total: toNum(raw?.total ?? raw?.totalCents, 0),
  };
}

export async function getCart() {
  const res = await get<any>('/cart');

  if ((res as any)?.status === 401 || String((res as any)?.error || '').toLowerCase() === 'unauthorized') {
    const guest = getGuestCart();
    if (!guest.length) {
      return {
        data: { items: [], totals: { subtotal: 0, shipping: 0, total: 0 } } as CartResponse,
        error: null,
        status: 200,
      };
    }

    const products = await getPublicProductsByIds(guest.map((g) => g.productId));
    const byId = new Map<number, any>(products.map((p: any) => [Number(p?.id ?? p?.productId), p]));

    const items = guest
      .map((g) => {
        const p = byId.get(g.productId);
        if (!p) return null;
        const title = String(p?.title ?? p?.name ?? 'Untitled item');
        const priceCentsNum = Number(p?.priceCents ?? p?.price ?? 0);
        const priceCents = Number.isFinite(priceCentsNum) ? Math.max(0, Math.trunc(priceCentsNum)) : 0;
        const quantity = Math.max(1, Math.trunc(Number((g as any).quantity ?? 1)));
        return {
          productId: g.productId,
          title,
          priceCents,
          qty: quantity,
          quantity,
          imageUrl: pickImageUrl(p),
        } as CartItem;
      })
      .filter(Boolean) as CartItem[];

    const subtotal = items.reduce((s, i) => s + i.priceCents * (i.quantity ?? i.qty ?? 1), 0);
    const totals = { subtotal, shipping: 0, total: subtotal };

    return {
      data: { items, totals } as CartResponse,
      error: null,
      status: 200,
    };
  }

  if (res?.data) {
    const raw = res.data;
    const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [];
    const totals = normalizeTotals(raw.totals ?? {});
    return { ...res, data: { items, totals } as CartResponse };
  }

  return res as { data: CartResponse | null; error?: string | null; status?: number };
}

export async function saveCart(body: PutCartBody) {
  const res = await put<{ ok: true }, PutCartBody>('/cart', body);
  if (!res.error) emit(EV_CART_CHANGED);
  return res;
}

export async function setCartShippingRule(ruleId: number | string) {
  const res = await put<{ ok: true }, SetShippingRuleBody>('/cart/shipping-rule', { ruleId });
  if (!res.error) emit(EV_SHIPPING_CHANGED, { ruleId });
  return res;
}

export function startCheckout(amountCents: number) {
  return post<CheckoutResponse, { amountCents: number }>('/cart/checkout', { amountCents });
}

export async function addToCart(productId: number, addQty = 1) {
  const res = await getCart();
  const { data, error, status } = res as {
    data: CartResponse | null;
    error?: string | null;
    status?: number;
  };

  if (status === 401 || status === 403) {
    addToGuestCart(productId, addQty);
    emit(EV_CART_CHANGED);
    return { data: { ok: true } as any, error: null, status: 200 };
  }
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

  const saved = await saveCart({ items });
  if ((saved as any)?.status === 401 || (typeof (saved as any)?.error === 'string' && (saved as any).error.toLowerCase().includes('unauthorized'))) {
    addToGuestCart(productId, addQty);
    emit(EV_CART_CHANGED);
    return { data: { ok: true } as any, error: null, status: 200 };
  }
  return saved;
}

export async function removeFromCart(productId: number) {
  const res = await getCart();
  const { data, error, status } = res as {
    data: CartResponse | null;
    error?: string | null;
    status?: number;
  };

  if (status === 401 || status === 403) {
    removeFromGuestCart(productId);
    emit(EV_CART_CHANGED);
    return { data: { ok: true } as any, error: null, status: 200 };
  }
  if (error || !data) return { data: null, error: error ?? 'LOAD_FAILED', status };

  const items = (data.items ?? [])
    .filter((it) => Number(it.productId) !== Number(productId))
    .map((it) => ({
      productId: Number(it.productId),
      quantity: Math.max(0, Math.trunc(Number(it.quantity ?? it.qty ?? 0))),
    }));

  const saved = await saveCart({ items });
  if ((saved as any)?.status === 401 || (typeof (saved as any)?.error === 'string' && (saved as any).error.toLowerCase().includes('unauthorized'))) {
    removeFromGuestCart(productId);
    emit(EV_CART_CHANGED);
    return { data: { ok: true } as any, error: null, status: 200 };
  }
  return saved;
}

export async function clearCart() {
  const saved = await saveCart({ items: [] });
  if ((saved as any)?.status === 401 || (typeof (saved as any)?.error === 'string' && (saved as any).error.toLowerCase().includes('unauthorized'))) {
    const ls = typeof window !== 'undefined' ? window.localStorage : null;
    ls?.setItem('mc.guestcart.v1', JSON.stringify([]));
    emit(EV_CART_CHANGED);
    return { data: { ok: true } as any, error: null, status: 200 };
  }
  return saved;
}
