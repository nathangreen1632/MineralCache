// Client/src/pages/vendor/VendorOrdersPage.tsx
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
};

function mergeOrders(rows: VendorOrderRow[]): VendorOrderRow[] {
  const byId = new Map<number, VendorOrderRow>();
  for (const r of rows) {
    const k = Number(r.orderId);
    const existing = byId.get(k);
    if (!existing) {
      byId.set(k, { ...r, items: [...r.items] });
    } else {
      existing.items.push(...r.items);
      existing.totalCents = Number.isFinite(existing.totalCents) ? existing.totalCents : r.totalCents;
      if (!existing.createdAt && r.createdAt) existing.createdAt = r.createdAt;
      if (!existing.status && r.status) existing.status = r.status;
    }
  }
  return Array.from(byId.values());
}

function filterItemsForTab(items: VendorOrderItem[], t: Tab): VendorOrderItem[] {
  if (t === 'paid') return items.filter((it) => !it.shippedAt && !it.deliveredAt);
  if (t === 'shipped') return items.filter((it) => !!it.shippedAt && !it.deliveredAt);
  return items.filter((it) => !!it.deliveredAt);
}

export default function VendorOrdersPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('paid');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<VendorOrderRow[]>([]);
  const [page, setPage] = useState(1);

  // selection: { [orderId]: { [orderItemId]: true } }
  const [selectedByOrder, setSelectedByOrder] = useState<Record<number, Record<number, true>>>({});

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
    p.set('expanded', '1');
    return p.toString();
  }, [tab, page]);

  async function load() {
    setBusy(true);
    setMsg(null);
    try {
      const path = `/vendors/me/orders${query ? `?${query}` : ''}`;
      const res = await get<any>(path);
      const raw = (res as any)?.data ?? res;

      const source = Array.isArray(raw?.orders)
        ? raw.orders
        : Array.isArray(raw?.items)
          ? raw.items
          : [];

      let list: VendorOrderRow[] = source.map((o: any): VendorOrderRow => {
        const items: VendorOrderItem[] = Array.isArray(o.items)
          ? o.items.map((it: any) => {
            // derive a true order-item id; accept common shapes
            const idRaw =
              it.orderItemId ??
              it.order_item_id ??
              it.orderItem?.id ??
              it.id;

            const parsedId = Number(idRaw);
            const orderItemId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

            const shippedAt = it.shippedAt ?? it.shipped_at ?? null;
            const deliveredAt = it.deliveredAt ?? it.delivered_at ?? null;

            const shipCarrier = (it.shipCarrier ?? it.ship_carrier ?? null) as ShipCarrier | null;
            const shipTracking = (it.shipTracking ?? it.ship_tracking ?? null) as string | null;

            return {
              id: orderItemId ?? -1, // internal row key; not used for API if < 0
              orderItemId,
              orderId: Number(it.orderId ?? o.orderId ?? o.id),
              productId: Number(it.productId),
              vendorId: Number(it.vendorId),
              title: String(it.title ?? it.productTitle ?? 'Item'),
              quantity: Number(it.quantity ?? 1),
              unitPriceCents: Number(it.unitPriceCents ?? it.priceCents ?? it.unit_price_cents ?? 0),
              lineTotalCents: Number(
                it.lineTotalCents ??
                it.totalCents ??
                it.line_total_cents ??
                Number(it.quantity ?? 1) * Number(it.unitPriceCents ?? it.unit_price_cents ?? 0)
              ),
              shipCarrier,
              shipTracking,
              shippedAt,
              deliveredAt,
            };
          })
          : [];

        return {
          orderId: Number(o.orderId ?? o.id),
          createdAt: String(o.createdAt ?? o.created_at ?? ''),
          status: String(o.status) as OrderStatus,
          totalCents: Number(o.totalCents ?? o.total_cents ?? 0),
          items,
        };
      });

      list = mergeOrders(list);
      list = list
        .map((o) => ({ ...o, items: filterItemsForTab(o.items, tab) }))
        .filter((o) => o.items.length > 0);

      setRows(list);
    } catch (e: any) {
      setMsg(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setSelectedByOrder({});
    setShipDialog({ open: false, orderId: null, carrier: 'usps', tracking: '' });
    setPage(1);
    void load();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleItem(orderId: number, itemId: number) {
    setSelectedByOrder((prev) => {
      const cur = prev[orderId] ? { ...prev[orderId] } : {};
      if (cur[itemId]) delete cur[itemId];
      else cur[itemId] = true;
      return { ...prev, [orderId]: cur };
    });
  }

  function clearSelection(orderId: number) {
    setSelectedByOrder((p) => ({ ...p, [orderId]: {} }));
  }

  async function doShip(orderId: number) {
    const selected = selectedByOrder[orderId] ?? {};
    const itemIds = Object.keys(selected)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (itemIds.length === 0) return;

    const carrier = normalizeCarrier(shipDialog.carrier) ?? 'other';
    const tracking = shipDialog.tracking.trim() || null;

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
    const selected = selectedByOrder[orderId] ?? {};
    const itemIds = Object.keys(selected)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
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
          const selectedMap = selectedByOrder[o.orderId] ?? {};
          const selectedCount = Object.keys(selectedMap).length;
          const showShip = tab === 'paid';
          const showDeliver = tab === 'shipped';

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
                      disabled={selectedCount === 0}
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
                      disabled={selectedCount === 0}
                      onClick={() => void doDeliver(o.orderId)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>

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
                    const fulfill = it.deliveredAt
                      ? `Delivered ${new Date(it.deliveredAt).toLocaleString()}`
                      : it.shippedAt
                        ? `Shipped ${new Date(it.shippedAt).toLocaleString()}${
                          it.shipTracking ? ` • ${it.shipCarrier?.toUpperCase() ?? ''} ${it.shipTracking}` : ''
                        }`
                        : 'Not shipped';

                    // derive a selectable id from orderItemId || id; must be positive int
                    const rawSelectId =
                      typeof it.orderItemId === 'number'
                        ? it.orderItemId
                        : Number(it.orderItemId ?? it.id);
                    const selectId = Number.isFinite(rawSelectId) && rawSelectId > 0 ? rawSelectId : null;

                    const canSelect =
                      selectId != null &&
                      (tab === 'paid'
                        ? !it.shippedAt && !it.deliveredAt
                        : tab === 'shipped'
                          ? !!it.shippedAt && !it.deliveredAt
                          : false);

                    const isChecked = selectId != null ? Boolean((selectedMap as any)[selectId]) : false;

                    return (
                      <tr
                        key={`${o.orderId}-${selectId ?? `row${idx}`}`}
                        className="border-b last:border-b-0"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <td className="px-3 py-2">
                          {tab !== 'delivered' ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!canSelect}
                              onChange={() => selectId != null && toggleItem(o.orderId, selectId)}
                            />
                          ) : (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{it.title}</td>
                        <td className="px-3 py-2">{it.quantity}</td>
                        <td className="px-3 py-2">{centsToUsd(it.unitPriceCents)}</td>
                        <td className="px-3 py-2">{centsToUsd(it.lineTotalCents)}</td>
                        <td className="px-3 py-2">{fulfill}</td>
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
                onClick={() => void doShip(shipDialog.orderId!)}
                className="rounded-lg px-3 py-2 text-sm font-semibold"
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
