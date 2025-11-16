import React, { useEffect, useMemo, useState } from 'react';
import { buildPackingSlipUrl } from '../../api/vendorOrders';
import { markOrderDelivered, markOrderShipped, type ShipCarrier } from '../../api/orders';
import { centsToUsd } from '../../utils/money.util';
import { get } from '../../lib/api';

type Tab = 'paid' | 'shipped' | 'delivered';
type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'delivered'
  | 'shipped';

const ALLOWED_CARRIERS = ['usps', 'ups', 'fedex', 'dhl', 'other'] as const;

function normalizeCarrier(input: string | null | undefined): ShipCarrier | null {
  const v = (input ?? '').trim().toLowerCase();
  return (ALLOWED_CARRIERS as readonly string[]).includes(v) ? (v as ShipCarrier) : null;
}

function getMinTrackingLength(carrier: ShipCarrier | null): number {
  switch (carrier) {
    case 'usps':
      return 20;
    case 'ups':
      return 18;
    case 'fedex':
      return 12;
    case 'dhl':
      return 10;
    default:
      return 8;
  }
}

type VendorOrderItem = {
  id: number;
  orderItemId?: number | null;
  orderId: number;
  productId: number;
  vendorId: number;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  shipCarrier?: ShipCarrier | null;
  shipTracking?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

type VendorOrderRow = {
  orderId: number;
  createdAt: string;
  status: OrderStatus | string;
  items: VendorOrderItem[];
  totalCents: number;
  shippingName: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostal: string | null;
  shippingCountry: string | null;
};

function isDelivered(o: VendorOrderRow) {
  if (String(o.status) === 'delivered') return true;
  if (!Array.isArray(o.items) || o.items.length === 0) return false;
  for (const it of o.items) if (!it?.deliveredAt) return false;
  return true;
}

function dedupeByOrderId(rows: VendorOrderRow[]): VendorOrderRow[] {
  const m = new Map<number, VendorOrderRow>();
  for (const r of rows) {
    const k = Number(r.orderId);
    if (!m.has(k)) m.set(k, r);
  }
  return Array.from(m.values());
}

export default function VendorOrdersPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('paid');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<VendorOrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [selectedByOrder, setSelectedByOrder] = useState<Record<number, Set<number>>>({});
  const [shipDialog, setShipDialog] = useState<{
    open: boolean;
    orderId: number | null;
    carrier: ShipCarrier;
    tracking: string;
  }>({ open: false, orderId: null, carrier: 'usps', tracking: '' });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('pageSize', '50');
    if (tab === 'paid') p.set('status', 'paid');
    if (tab === 'shipped') p.set('status', 'shipped');
    if (tab === 'delivered') p.set('status', 'delivered');
    p.set('expanded', '1');
    return p.toString();
  }, [tab, page]);

  async function load() {
    setBusy(true);
    setMsg(null);
    try {
      const path = `/vendors/me/orders?${query}`;
      const res = await get<{ orders?: any[]; total?: number }>(path);
      const raw = (res as any)?.data ?? res;

      let list: VendorOrderRow[] = Array.isArray(raw?.orders)
        ? raw.orders.map((o: any): VendorOrderRow => {
          const items: VendorOrderItem[] = Array.isArray(o.items)
            ? o.items.map((it: any) => {
              const rawId =
                it.orderItemId ??
                it.order_item_id ??
                it.orderItem?.id ??
                it.id;
              const n = Number(rawId);
              const cleanId = Number.isFinite(n) && n > 0 ? n : null;

              const qty = Number(it.quantity ?? 1);
              const unit = Number(it.unitPriceCents ?? it.priceCents ?? 0);
              const line =
                Number(it.lineTotalCents ?? it.totalCents) ?? qty * unit;

              return {
                id: cleanId ?? -1,
                orderItemId: cleanId,
                orderId: Number(it.orderId ?? o.orderId ?? o.id),
                productId: Number(it.productId),
                vendorId: Number(it.vendorId),
                title: String(it.title ?? it.productTitle ?? 'Item'),
                quantity: qty,
                unitPriceCents: unit,
                lineTotalCents: Number(line),
                shipCarrier: (it.shipCarrier ?? null) as ShipCarrier | null,
                shipTracking: (it.shipTracking ?? null) as string | null,
                shippedAt: it.shippedAt ?? null,
                deliveredAt: it.deliveredAt ?? null,
              } as VendorOrderItem;
            })
            : [];

          const filtered =
            tab === 'paid'
              ? items.filter((it) => !it.shippedAt && !it.deliveredAt)
              : tab === 'shipped'
                ? items.filter((it) => !!it.shippedAt && !it.deliveredAt)
                : items.filter((it) => !!it.deliveredAt);

          return {
            orderId: Number(o.orderId ?? o.id),
            createdAt: String(o.createdAt ?? o.created_at ?? ''),
            status: String(o.status) as OrderStatus,
            totalCents: Number(o.totalCents ?? o.total_cents ?? 0),
            items: filtered,
            shippingName: (o.shippingName ?? o.shipping_name ?? null) as string | null,
            shippingAddress1: (o.shippingAddress1 ?? o.shipping_address1 ?? null) as string | null,
            shippingAddress2: (o.shippingAddress2 ?? o.shipping_address2 ?? null) as string | null,
            shippingCity: (o.shippingCity ?? o.shipping_city ?? null) as string | null,
            shippingState: (o.shippingState ?? o.shipping_state ?? null) as string | null,
            shippingPostal: (o.shippingPostal ?? o.shipping_postal ?? null) as string | null,
            shippingCountry: (o.shippingCountry ?? o.shipping_country ?? null) as string | null,
          };
        })
        : [];

      list = list.filter((o) => o.items.length > 0);

      if (tab === 'delivered') list = list.filter(isDelivered);

      list = dedupeByOrderId(list);

      setRows(list);
    } catch (e: any) {
      setMsg(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setSelectedByOrder({});
    void load();
  }, [tab, page]);

  function toggleItem(orderId: number, itemId: number) {
    if (!Number.isFinite(itemId) || itemId <= 0) return;
    setSelectedByOrder((prev) => {
      const cur = new Set(prev[orderId] ?? []);
      if (cur.has(itemId)) cur.delete(itemId);
      else cur.add(itemId);
      return { ...prev, [orderId]: cur };
    });
  }

  function clearSelection(orderId: number) {
    setSelectedByOrder((p) => ({ ...p, [orderId]: new Set<number>() }));
  }

  async function doShip(orderId: number) {
    const itemIds = Array.from(selectedByOrder[orderId] ?? []).filter(
      (n) => Number.isFinite(n) && n > 0
    );
    if (itemIds.length === 0) return;

    const carrier = normalizeCarrier(shipDialog.carrier);
    const tracking = shipDialog.tracking.trim();

    if (!carrier) {
      setMsg('Please select a shipping carrier.');
      return;
    }

    if (!tracking) {
      setMsg('Please enter a tracking number.');
      return;
    }

    const minLen = getMinTrackingLength(carrier);
    if (tracking.length < minLen) {
      setMsg(
        `Tracking number looks too short for ${carrier.toUpperCase()}. Minimum ${minLen} characters.`
      );
      return;
    }

    setBusy(true);
    const r = await markOrderShipped(orderId, carrier, tracking, itemIds);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error || 'Ship failed');
      return;
    }

    setShipDialog({ open: false, orderId: null, carrier: 'usps', tracking: '' });
    clearSelection(orderId);
    await load();
  }

  async function doDeliver(orderId: number) {
    const itemIds = Array.from(selectedByOrder[orderId] ?? []).filter((n) => Number.isFinite(n) && n > 0);
    if (itemIds.length === 0) return;
    setBusy(true);
    const r = await markOrderDelivered(orderId, itemIds);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error || 'Deliver failed');
      return;
    }
    clearSelection(orderId);
    await load();
  }

  const card = {
    background: 'var(--theme-card)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
  } as const;

  return (
    <section className="mx-auto max-w-12xl px-6 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-semibold text-[var(--theme-text)]">Customer Orders</h1>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('paid')}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold border ${
            tab === 'paid'
              ? 'bg-[var(--theme-card)] border-[var(--theme-border)]'
              : 'border-transparent hover:bg-[var(--theme-surface)]'
          }`}
        >
          Paid
        </button>
        <button
          onClick={() => setTab('shipped')}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold border ${
            tab === 'shipped'
              ? 'bg-[var(--theme-card)] border-[var(--theme-border)]'
              : 'border-transparent hover:bg-[var(--theme-surface)]'
          }`}
        >
          Shipped
        </button>
        <button
          onClick={() => setTab('delivered')}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold border ${
            tab === 'delivered'
              ? 'bg-[var(--theme-card)] border-[var(--theme-border)]'
              : 'border-transparent hover:bg-[var(--theme-surface)]'
          }`}
        >
          Delivered
        </button>
      </div>

      {msg && (
        <div className="rounded-md border px-3 py-2 text-sm" style={card} role="alert">
          <span style={{ color: 'var(--theme-error)' }}>{msg}</span>
        </div>
      )}

      {busy && rows.length === 0 ? (
        <div className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)' }} />
      ) : rows.length === 0 ? (
        <div className="text-sm opacity-75">No orders yet.</div>
      ) : (
        rows.map((o) => {
          const selected = selectedByOrder[o.orderId] ?? new Set<number>();
          const showShip = tab === 'paid';
          const showDeliver = tab === 'shipped';

          const hasShipTo =
            o.shippingName ||
            o.shippingAddress1 ||
            o.shippingAddress2 ||
            o.shippingCity ||
            o.shippingState ||
            o.shippingPostal ||
            o.shippingCountry;

          const shipLine = [o.shippingCity, o.shippingState, o.shippingPostal, o.shippingCountry]
            .filter(Boolean)
            .join(', ');

          return (
            <div key={o.orderId} className="rounded-2xl border p-4 grid gap-3" style={card}>
              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Order #{o.orderId}</div>
                <div className="flex items-center gap-2">
                  {tab !== 'delivered' ? (
                    <a
                      href={buildPackingSlipUrl(o.orderId)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl px-3 py-1 border bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
                    >
                      Packing slip
                    </a>
                  ) : (
                    <span className="opacity-60">—</span>
                  )}

                  {showShip && (
                    <button
                      type="button"
                      disabled={selected.size === 0}
                      onClick={() =>
                        setShipDialog({ open: true, orderId: o.orderId, carrier: 'usps', tracking: '' })
                      }
                      className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
                    >
                      Mark Shipped
                    </button>
                  )}

                  {showDeliver && (
                    <button
                      type="button"
                      disabled={selected.size === 0}
                      onClick={() => void doDeliver(o.orderId)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>

              {hasShipTo && (
                <div className="text-xs text-[var(--theme-text)] opacity-80">
                  <div className="font-semibold">Ship to</div>
                  {o.shippingName && <div>{o.shippingName}</div>}
                  {o.shippingAddress1 && <div>{o.shippingAddress1}</div>}
                  {o.shippingAddress2 && <div>{o.shippingAddress2}</div>}
                  {shipLine && <div>{shipLine}</div>}
                </div>
              )}

              <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--theme-border)' }}>
                <table className="w-full text-sm">
                  <thead className="text-left">
                  <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Line Total</th>
                    <th className="px-3 py-2">Fulfillment</th>
                  </tr>
                  </thead>
                  <tbody>
                  {o.items.map((it, idx) => {
                    const selectId =
                      Number.isFinite(it.orderItemId) && (it.orderItemId as number) > 0
                        ? (it.orderItemId as number)
                        : Number.isFinite(it.id) && it.id > 0
                          ? it.id
                          : null;

                    const selectable =
                      selectId != null &&
                      (tab === 'paid'
                        ? !it.shippedAt && !it.deliveredAt
                        : tab === 'shipped'
                          ? !!it.shippedAt && !it.deliveredAt
                          : false);

                    const selectedSet = selectedByOrder[o.orderId] ?? new Set<number>();
                    const isChecked = selectId != null ? selectedSet.has(selectId) : false;

                    return (
                      <tr
                        key={`${o.orderId}-${selectId ?? idx}`}
                        className="border-b last:border-b-0"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <td className="px-3 py-2">
                          {selectId != null ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(o.orderId, selectId)}
                            />
                          ) : (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{it.title}</td>
                        <td className="px-3 py-2">{it.quantity}</td>
                        <td className="px-3 py-2">{centsToUsd(it.unitPriceCents)}</td>
                        <td className="px-3 py-2">{centsToUsd(it.lineTotalCents)}</td>
                        <td className="px-3 py-2">{selectable ? 'Ready' : ''}</td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Placed {new Date(o.createdAt).toLocaleString()}</div>
                <div className="text-sm font-semibold">Total {centsToUsd(o.totalCents)}</div>
              </div>
            </div>
          );
        })
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || busy}
          className="rounded-lg px-3 py-1 text-sm border border-[var(--theme-border)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
        >
          Prev
        </button>
        <div className="opacity-80 text-sm">Page {page}</div>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={busy}
          className="rounded-lg px-3 py-1 text-sm border border-[var(--theme-border)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
        >
          Next
        </button>
      </div>

      {shipDialog.open && shipDialog.orderId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 w-[min(92vw,440px)] rounded-2xl border p-5 grid gap-3" style={card}>
            <div className="text-lg font-semibold">Mark Shipped</div>
            <div className="grid gap-2">
              <label className="text-xs opacity-70" htmlFor="carrier">
                Carrier
              </label>
              <select
                id="carrier"
                value={shipDialog.carrier}
                onChange={(e) => setShipDialog((s) => ({ ...s, carrier: e.target.value as ShipCarrier }))}
                className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <option value="usps">USPS</option>
                <option value="ups">UPS</option>
                <option value="fedex">FedEx</option>
                <option value="dhl">DHL</option>
                <option value="other">Other</option>
              </select>

              <label className="text-xs opacity-70 mt-2" htmlFor="tracking">
                Tracking #
              </label>
              <input
                id="tracking"
                value={shipDialog.tracking}
                onChange={(e) => setShipDialog((s) => ({ ...s, tracking: e.target.value }))}
                placeholder="e.g. 9400 1000 0000 0000 0000 00"
                className="rounded border px-2 py-1 bg-[var(--theme-textbox)]"
                style={{ borderColor: 'var(--theme-border)' }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShipDialog({ open: false, orderId: null, carrier: 'usps', tracking: '' })}
                className="rounded-lg px-3 py-2 text-sm ring-1 ring-inset"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (selectedByOrder[shipDialog.orderId ?? -1]?.size ?? 0) === 0 ||
                  !normalizeCarrier(shipDialog.carrier) ||
                  shipDialog.tracking.trim().length <
                  getMinTrackingLength(normalizeCarrier(shipDialog.carrier))
                }
                onClick={() => shipDialog.orderId != null && void doShip(shipDialog.orderId)}
                className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
              >
                Ship selected
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
