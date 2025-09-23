# Mineral Cache — Week-3 Objectives (Payments, Orders, Vendor Tools)

> Focus: turn **payments on** (test mode), make **orders** end‑to‑end shippable, and round out **vendor & admin tools**. Keep Stripe/auctions behind feature flags so the app works gracefully when disabled.

## Backend (API)

- **Stripe enablement (test mode)**
    - Respect `STRIPE_ENABLED` flag; if on, require keys at boot and expose readiness in `/health`.
    - `POST /checkout/intent` → compute totals from server cart; create **PaymentIntent** with amount + currency; return `{ clientSecret }`.
    - Webhooks: handle `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded` (verify signature).
    - Idempotency keys on checkout creation; persist `paymentIntentId` on the order.
    - Application fees: compute and persist platform fee (8% + $0.75) in order records; keep Connect wiring toggled **off** for now.

- **Orders E2E**
    - Create **Order** + **OrderItems** from the cart on checkout (status: `pending_payment` → `paid` / `failed` via webhook).
    - Persist shipping per vendor and totals; write `commissionCents`/`commissionPct` on each order row.
    - Inventory lock: mark product as `sold`/`archived` (or set `status` accordingly) after payment success to prevent re‑sale.
    - Expose buyer endpoints: `GET /me/orders`, `GET /me/orders/:id` (only own orders).
    - Expose vendor endpoints: `GET /vendors/:id/orders` (own vendor only), with pagination & date range filters.

- **Shipping rules**
    - Read from `shipping_rules` (global or vendor‑specific); implement rule selection and per‑vendor shipping on the cart.
    - Store the chosen rule snapshot on the order (resilient to future rule changes).

- **Uploads polish**
    - Photo management helpers: set **primary** photo, **reorder** photos, soft‑delete with restore.
    - Purge staged uploads older than N hours (maintenance task/endpoint), leaving a safety margin.

- **Admin settings**
    - `GET /admin/settings` already returns commission/min fee; add **shipping defaults** and `stripeEnabled` flags.
    - `PATCH /admin/settings` (optional, behind auth) for toggling flags and updating shipping defaults.

- **Observability & safeguards**
    - Include `requestId` and `userId` in structured logs for checkout/order lifecycle.
    - Rate‑limit: add register endpoint limiter; keep upload and login limiters in place.
    - Ensure graceful JSON errors across new endpoints.

## Frontend (App UX)

- **Checkout with Stripe Elements**
    - Mount Card Element on `/checkout` when Stripe is enabled; handle 3DS flows; show friendly errors and disabled states while confirming.
    - On success: route to **Order Confirmation** page with summary, order number, and next steps.

- **Cart & Order UX**
    - Totals sourced from server; auto‑refresh when items change or shipping rules update.
    - New pages:
        - **My Orders** list (`/account/orders`) + **Order Detail** with items, totals, shipping, and status.
        - **Order Confirmation** page after successful payment.

- **Vendor Dashboard v2**
    - **Products** table: quick toggles for `onSale`/archive; link to edit; surface primary image and photo count.
    - **Orders** tab: list orders containing this vendor’s items; basic filters (status/date).
    - **Photos** tab on Product Edit: drag‑to‑reorder, set primary, delete/restore; show derivative sizes (320/800/1600).

- **Admin UI**
    - **Orders** list with filters (status, vendor, date); click to view details.
    - **Settings** screen for commission/min fee + shipping defaults; read‑only display of Stripe status.

- **Catalog polish**
    - Search box with keyword highlighting; remember last filters/sort in query params.
    - Product detail: small image gallery strip + primary image focus.

## DevOps & Quality

- **Seeds**
    - Extend seed data with one **buyer** user and **1–2 demo orders** (paid + failed), including order items and photo references.

- **CI**
    - Ensure Client/Server build + typecheck pass (already in CI). Add a lint step if not present.

- **Ops**
    - Document required env vars for payments (`STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, currency).

> Note: Postman/Insomnia collections and integration tests were intentionally **skipped** in Week‑2; they remain optional for Week‑3.

## Stretch (if time permits)

- **Auctions MVP**
    - Implement `POST /auctions/:id/bid` with increment ladder and **proxy‑bid** placeholder; validate age‑gate and balances.
    - Socket room updates: broadcast leading bid, outbid notices, and countdown ticks.
    - Product page: simple bidding panel with live high bid and time left.

- **Vendor payouts (prep)**
    - Add **Connect Express** onboarding link behind a feature flag (no transfers yet); store account id if created.

- **Performance**
    - Add indexes for orders (buyerId, vendorId, createdAt) and product search if needed; verify query plans on list endpoints.
