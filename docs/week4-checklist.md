# Mineral Cache — Week‑4 Checklist

_This plan builds directly on Week‑3. No linting, no Postman/Insomnia, no seed data (per your notes)._

---

## 1) Post‑payment lifecycle & notifications

- [ ] **Buyer emails** (gated by `EMAIL_ENABLED`): order confirmation on `paid`, shipment, delivery.
    - [ ] Server: add `services/email.service.ts` with minimal send helpers.
    - [ ] Emit emails from webhook (`paid`) and from `markShipped` / `markDelivered`.
    - [ ] Admin settings: add `emailFrom`, `brandName` (read via `/admin/settings`).

- [ ] **In‑app notifications**: toast/banner after payment; “Your order shipped” badge in **My Orders**.

- [ ] **Receipts**: `GET /orders/:id/receipt` → simple HTML (PDF later).

---

## 2) Fulfillment & vendor workflow polish

- [ ] **Tracking & statuses**: extend `OrderItem` with `shipCarrier`, `shipTracking`, `shippedAt`, `deliveredAt`.
    - [ ] Wire to `PATCH /orders/:id/ship` and `/orders/:id/deliver` (persist fields).

- [ ] **Packing slips**: per‑vendor printable page (`/vendors/orders/:id/pack`).

- [ ] **Prevent cart staleness**: if a product is archived/paid by someone else, surface a precise error when it’s still in another user’s cart (validate in `PUT /cart` and during checkout).

---

## 3) Refunds & cancellations (safe subset)

- [ ] **Admin refunds**: `POST /admin/orders/:id/refund` (full refunds only).
    - [ ] Call Stripe `refunds.create`, set `refundedAt`, set status → `refunded`.
    - [ ] Admin UI: button + confirm modal + result banner.

- [ ] **Buyer cancel (pre‑payment)**: allow cancel of `pending_payment` orders (API + UI).

---

## 4) Sales tax (domestic, basic)

- [ ] **Toggle** via `TAX_ENABLED=false` default.

- [ ] **Computation** (no Avalara/TaxJar yet):
    - [ ] Add `taxCents` to `Order`.
    - [ ] Compute server‑side during totals; display on Client (Cart, Checkout, Orders).
    - [ ] Admin settings: `taxRateBps`, `taxLabel` (e.g., “State sales tax”).
    - [ ] Keep opt‑in so app continues to run without config.

---

## 5) Vendor payouts (prep, no live transfers)

- [ ] **Balance snapshots** at `paid`: derive per‑vendor **gross** (items + shipping).
    - [ ] Store to `order_vendor` (new) with `vendorGrossCents`, `vendorNetCents` (net of platform fee proportion).

- [ ] **Statements**: `GET /vendors/me/payouts` summarizing paid orders in a date range; add CSV export.

- [ ] **UI**: Vendor Dashboard → “Payouts” tab with simple table (no live Stripe balance).

---

## 6) Search & catalog performance

- [ ] **Indexes**:
    - [ ] `orders (buyerUserId, createdAt)`
    - [ ] `order_items (vendorId, createdAt)`
    - [ ] `products (status, onSale, createdAt)`

- [ ] **Keyword search**: add trigram/ILIKE indexes for `products(title, species, locality)` and use them in `/search` with pagination.

---

## 7) Security & safeguards polish

- [ ] **Webhook idempotency log**: `webhook_events` table keyed by Stripe event `id` + `type` (guard duplicates).

- [ ] **PII redaction**: centralize redaction in `log.service.ts`; ensure emails/addresses never hit logs.

- [ ] **Rate‑limit** `POST /checkout/intent`: e.g., 10/min per userOrIp.

---

## 8) UX refinements (Client)

- [ ] **Order detail**: per‑vendor shipping lines, tracking links, and breakdown rows (subtotal, shipping, **tax** if enabled, **total**).

- [ ] **Vendor Orders tab**: filter by `paid` / `shipped` / `refunded`; add **Export CSV** button.

- [ ] **Catalog**: persist filters/sort in query string (verify); add keyword **highlight** in list view.

---

## Suggested PR slices (to keep diffs small)

1. **Fulfillment fields + Admin/Vendor UI** (tracking, shipped/delivered, packing slip).
2. **Emails + toggles** (`EMAIL_ENABLED`, templates, webhook emits).
3. **Refunds (admin‑only)** + status plumbing.
4. **Tax** (toggle, compute, display).
5. **Payouts prep** (vendor statements + CSV; no transfers).
6. **Search/indexes** (DB migrations + `/search` tuning).
7. **Security polish** (webhook idempotency + redaction + checkout limiter).

---

### Notes
- Keep Stripe Connect transfers **off**; Week‑4 focuses on accounting snapshots only.
- Continue using graceful JSON errors and structured logs (`requestId`, `userId`).
- Skip seeds and linting as previously agreed.
