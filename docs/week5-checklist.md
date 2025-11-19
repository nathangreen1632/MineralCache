# Mineral Cache — Week‑5 Backlog Plan
*(Thread: “week 5 backlog plan” — based on deep scan of `root/`, `Client/`, and `Server/` in the provided repo)*

> Focus: finish Week‑4 leftovers, ship printable artifacts, bring auctions to life on the Client, harden auth/ACL on fulfillment, and tighten ops/docs so the app is demo‑ready.

---

## What’s already in place (scan highlights)
- **Emails**: `services/email.service.ts` (Resend) with `order_paid/shipped/delivered` templates; webhook sends `order_paid`. Admin settings expose `brandName/emailFrom`.
- **Fulfillment**: `OrderItem` has `shipCarrier/shipTracking/shippedAt/deliveredAt`; routes exist for `PATCH /orders/:id/ship` and `/deliver`, and these send emails.
- **Receipts (HTML)**: `GET /orders/:id/receipt` returns a simple HTML receipt (PDF not yet).
- **Refunds**: Admin refunds flow scaffolded (`controllers/admin/orders.controller.ts`) calling Stripe refunds; route is wired.
- **Tax (basic)**: `tax.service.ts` + `TAX_ENABLED` support; `taxCents` on `Order`; Client shows tax on Orders/Cart.
- **Vendor payouts (snapshots)**: `order_vendor` model + `/vendors/me/payouts` with CSV option on the API side; Client has `VendorPayoutsPage.tsx` (table, no CSV button yet).
- **Search perf**: catalog indexes and trigram indexes landed; search controller (`/api/search`) with pagination and **keyword highlighting** in `ProductShopListLogic.tsx`.
- **Security/PII**: centralized redaction in `log.service.ts`; webhook idempotency via `webhook_events`.
- **Rate limiting**: `POST /checkout/intent` guarded.
- **Auctions (server)**: models, services, socket emitters & ticker are present; Client UI still minimal.
- **Ops/Health**: `/health` returns Stripe readiness.

---

## Week‑5 Objectives

### 1) Finish Week‑4 leftovers (UI + printable docs)
**Why:** Close visible gaps and make the purchase/ship loop feel complete.

- **Packing slips (per‑vendor)**
    - API: `GET /api/vendor/orders/:id/pack` → server‑rendered HTML (no auth = 401; only vendor owning items may view).
    - Client: Vendor Orders table → “Print packing slip” button (opens printable window).
    - Acceptance: printed slip lists vendor items only, buyer ship‑to, order id/date; works for partial shipments (selected item IDs).

- **CSV export buttons**
    - Vendor Orders: “Export CSV” (client button calling existing API, save as `vendor-orders-YYYYMMDD.csv`).
    - Admin Orders: Add `GET /api/admin/orders/export.csv` with current filters; button in Admin UI.
    - Acceptance: Columns match list view; date range respected; >5k rows stream without crashing the server.

- **In‑app notifications polish**
    - Client: small event bus/store (toast + banner). Show:
        - “Payment received” (from OrderConfirmation polling or redirect param).
        - “Order shipped” and “Order delivered” badges in *My Orders* auto‑refresh.
    - Acceptance: no duplicate toasts on route changes; accessible (aria‑live polite).

- **Receipts → PDF (phase 1)**
    - API: `/orders/:id/receipt.pdf` using Puppeteer to render existing HTML template.
    - Client: “Download PDF receipt” link on *Order Detail*.
    - Acceptance: brand and currency match Admin Settings; file < 500 KB for 10‑line order.

---

### 2) Auctions MVP — wire the Client to the Server
**Why:** Server foundation exists; Week‑5 delivers a working bidding experience in the product page.

- **Client Socket wiring**
    - Create a small socket client wrapper; auto join `auction:{id}` room on Product Detail when product has `auctionId`.
    - Live high bid display, “time left” countdown (use server “tick” events).

- **Bid panel (UI + rules)**
    - UI: field for bid amount (USD), min‑next‑bid hint from `/api/auctions/:id/minimum`.
    - POST `/auctions/:id/bid` with guardrails (age‑gate, logged‑in).
    - Acceptance: outbid notification appears within <1s; min‑bid enforced server‑side; errors show friendly messages.

- **Admin/Vendor visibility**
    - Add simple admin view listing active auctions with high bid & endsAt, for sanity checks.

---

### 3) Fulfillment ACLs & guardrails
**Why:** Prevent cross‑vendor shipping mistakes and tighten who can change statuses.

- **ACL updates**
    - `PATCH /orders/:id/ship|deliver`: verify caller is **vendor on at least one line** or **admin**; when vendor, only update their line items.
    - Server unit tests (lightweight) for: vendor A cannot ship vendor B’s lines; partial ship updates order status only when all lines shipped.

- **Carrier enums & tracking helpers**
    - Normalize `shipCarrier` to one of: `usps|ups|fedex|dhl|other`; add `trackingUrl()` on server.
    - Client ensures valid carrier selection; “Track package” deep link rendered per line.

---

### 4) Cart & product lifecycle hardening
**Why:** Reduce edge‑case support load.

- **Staleness recheck at checkout** (server): re‑use `validateAvailability()` *again* just before PI creation; return `409` with specific line(s).
- **Auto‑cleanup of abandoned carts** (cron-lite): nightly job removing carts older than N days; add script & docs.

---

### 5) Observability & Ops
**Why:** Faster debugging in test/stage; fewer “what happened?” moments.

- **/api/version** controller (git SHA, build time, source=git) surfaced on the Client footer.
- **Structured error surfaces**: bubble `rid` (requestId) into client to show on error banners.
- **README overhaul**: add envs for `EMAIL_ENABLED`, `RESEND_API_KEY`, `TAX_ENABLED`, `BRAND_NAME`, `EMAIL_FROM`, and Stripe keys; local webhook how‑to; CSV export notes.
- **Admin Settings UI**: expose email + brand + tax fields with validation hints.

---

### 6) Accessibility & UI polish (tokens respected)
**Why:** Consistency with your design tokens and better A11y scores.

- Buttons/links states: focus ring using `var(--theme-focus)` everywhere.
- Form labels + `aria-describedby`; ensure toasts have `aria-live="polite"`.
- Tables: header scope, caption where needed; color contrast checks for badges & marks.

---

## Stretch (if time allows)
- **Vendor statements (PDF)**: `/vendors/me/payouts.pdf` summary for date range.
- **Saved filters**: persist Admin Orders filters in query string + localStorage.
- **Multi‑address support**: scaffold address book on the buyer profile (future tax/address validation).

---

## Done‑when checklist (acceptance)
- Packing slips printable, gated by vendor ownership.
- CSV exports shipped for Vendor Orders and Admin Orders.
- Receipts downloadable as PDFs.
- Auctions panel functional with live bids and countdown.
- Fulfillment ACLs enforced; partial shipments are handled correctly.
- Docs updated; `/api/version` linked in UI; errors show request IDs.
- A11y pass brings keyboard and screen‑reader usability to parity across new UI.

