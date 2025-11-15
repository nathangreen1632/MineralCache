# MineralCache

> A multi-vendor marketplace for minerals, fossils, gemstones, and other collectibles — built as a full-stack, production-ready web app with Stripe Connect payouts.

---

## Table of Contents

- [Overview](#overview)
- [What this repo does](#what-this-repo-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
    - [Monorepo layout](#monorepo-layout)
    - [Backend (Server)](#backend-server)
    - [Frontend (Client)](#frontend-client)
    - [Background jobs & real-time](#background-jobs--real-time)
- [Stripe & payments](#stripe--payments)
    - [High-level payment model](#high-level-payment-model)
    - [Stripe Connect (vendors)](#stripe-connect-vendors)
    - [Checkout & order capture](#checkout--order-capture)
    - [Vendor payouts (“Delivered + 3 days”)](#vendor-payouts-delivered--3-days)
- [Vendor lifecycle (end-to-end)](#vendor-lifecycle-end-to-end)
- [Data model (high level)](#data-model-high-level)
- [Configuration & environment](#configuration--environment)
- [Running the project locally](#running-the-project-locally)
- [Planned / in-progress areas](#planned--in-progress-areas)

---

## Overview

**MineralCache** is a full-stack, multi-vendor marketplace focused on:

- Minerals, fossils, gemstones, crystals, and related collectibles.
- Vendor storefronts (approved sellers list and manage inventory).
- Fixed-price listings, with support for auctions and live bidding.
- Per-vendor shipping rules, commissions, and Stripe-powered payouts.
- A “platform as merchant of record” model: buyers always pay MineralCache, and vendors are paid out automatically after delivery windows.

The codebase is designed for production:

- Strong typing with TypeScript on both server and client.
- Schema validation with Zod.
- PostgreSQL + Sequelize ORM and migrations.
- Stripe Connect for vendor payouts.
- Real-time features via Socket.IO (auctions, bid events).
- Transactional email via Resend.
- Theming + responsive UI via Tailwind and CSS custom properties.

---

## What this repo does

At a high level, this repo implements:

- **Authentication & accounts**
    - Email/password auth, login, logout.
    - Password reset / forgot password flows.
    - Age verification gate.
    - Roles: guest, buyer, vendor, admin.

- **Vendor onboarding**
    - Vendor application flow (`VendorApply` page).
    - Admin review + approval of vendors.
    - Vendor profile (slug, logo, bio, location, etc).
    - Stripe Connect onboarding for vendor payouts.

- **Catalog & listings**
    - Categories + category pages.
    - Product creation/editing (for vendors).
    - Product catalog browsing & product detail pages.
    - Product images & uploads via `multer` + `sharp`.

- **Cart & checkout**
    - Cart management APIs + React cart pages.
    - Per-vendor shipping calculations with `ShippingRule` + tiers.
    - Optional tax handling (flat rate via admin settings/env).
    - Stripe PaymentIntents for card checkout.
    - Order confirmation and PDF receipt generation.

- **Orders & fulfillment**
    - Buyer “My Orders” page and order detail.
    - Vendor order dashboard (view & manage their own sales).
    - Shipping + tracking info (carrier normalization + tracking URLs).
    - Mark shipped / mark delivered workflows.
    - Email notifications for order paid/shipped/delivered.

- **Auctions**
    - Auction models (auction, bids, watchlist, locks).
    - Auction list/detail pages.
    - Real-time bidding via Socket.IO (tickers, emitters, auction modules).

- **Payouts & reporting**
    - Per-order, per-vendor accounting via the `OrderVendor` table.
    - Commission calculations (global + vendor overrides).
    - Nightly Stripe Transfers to vendors (“Delivered + 3 days” model).
    - Vendor payout history and unpaid/paid totals.
    - Admin-side manual trigger endpoint and CSV exports of payout data.

- **Legal & compliance**
    - Legal pages (ToS, Privacy, Shipping, etc.) rendered via `LegalPage`.
    - User agreements and acceptance tracking (`UserAgreement` model).
    - Age gating and explicit delivery obligations copy.

---

## Tech stack

### Frontend

- **Framework**: React + TypeScript
- **Bundler/Dev server**: Vite
- **Routing**: `react-router-dom`
- **State management**: `zustand`
- **Validation & types**: `zod`
- **UI & styling**:
    - Tailwind CSS (via `@tailwindcss/vite`)
    - Custom design tokens using CSS variables for light/dark themes
    - `lucide-react` for icons
    - `framer-motion` for small animations
- **Payments UI**:
    - `@stripe/stripe-js`
    - `@stripe/react-stripe-js`
- **UX utilities**:
    - `react-hot-toast` for toasts
    - `react-payment-logos` for card brand logos
- **Real-time**:
    - `socket.io-client` for auction updates

### Backend

- **Runtime**: Node.js
- **Language**: TypeScript (compiled to NodeNext ESM)
- **Framework**: Express 5
- **ORM**: Sequelize
- **Database**: PostgreSQL
- **Migrations**: `sequelize-cli`
- **Validation**: `zod`
- **Payments**: `stripe` (Stripe API SDK)
- **Real-time**: `socket.io`
- **Email**: `resend` (transactional email)
- **Other notable libs**:
    - `bcryptjs` for passwords
    - `multer` for file uploads
    - `sharp` for image processing
    - `pdfkit` (via `receiptPdf.service.ts`) for PDF receipts
    - `cookie-session`, `helmet`, `compression`, etc. for HTTP concerns

### Tooling & DX

- `concurrently` for running Client + Server in dev.
- TypeScript configs for both sides.
- Basic GitHub Actions CI and Sonar config.
- Weekly checklists in `docs/` for roadmap and progress tracking.

---

## Architecture

### Monorepo layout

Root:

- `Client/` – React + Vite frontend.
- `Server/` – Express + Sequelize backend.
- `docs/` – Project checklists / planning notes.
- `.github/` – CI workflows.
- `package.json` – Root scripts to drive both apps.
- `sonar-project.properties`, `.gitignore`, etc.

#### Client layout (high level)

- `Client/src/pages/`
    - `HomePage.tsx`
    - `CategoryPage.tsx`
    - `LegalPage.tsx`
    - `auth/*` (login, register, forgot/reset password, age verify)
    - `products/*` (catalog, create/edit, detail)
    - `cart/*` (cart, checkout)
    - `orders/*` (my orders, order details, receipt)
    - `auctions/*` (list, detail, create, edit)
    - `admin/*` (admin orders, auctions, vendor apps, payouts, etc.)
    - `vendor/*` (dashboard, orders, products, payouts)
- `Client/src/api/*` – thin wrappers around `/api/...` endpoints.
- `Client/src/components/*` – UI components (cards, forms, nav, branding, etc.).
- `Client/src/stores/*` – Zustand stores (auth, cart, etc.).
- `Client/src/utils/*` – helpers like `money.util`, tracking utils, etc.
- `Client/src/lib/api.ts` – fetch wrapper that talks to `/api/...` on the same origin.

#### Server layout (high level)

- `Server/src/server.ts` – Express + HTTP server bootstrap (Socket.IO, etc.).
- `Server/src/app.ts` – main Express app wiring: middleware, routes, jobs.
- `Server/src/routes/*` – route modules (`auth`, `products`, `orders`, `checkout`, `vendors`, `auctions`, `admin`, `webhooks`, etc.).
- `Server/src/controllers/*` – request handlers (business logic per domain).
- `Server/src/models/*` – Sequelize models:
    - `user`, `vendor`, `product`, `productImage`, `category`, `productCategory`
    - `cart`, `order`, `orderItem`, `orderVendor`
    - `auction`, `bid`, `auctionLock`, `auctionWatchlist`
    - `shippingRule`, `shippingRuleTier`
    - `adminSettings`, `userAgreement`, `passwordReset`, `webhookEvent`
- `Server/src/services/*` – domain services:
    - `stripe.service.ts` – Stripe integration (PaymentIntents, Connect, transfers, webhook verification).
    - `payouts.service.ts` – vendor commission calculations and `OrderVendor` materialization.
    - `shipping.service.ts` – shipping rule resolution and shipping cost calculation.
    - `tax.service.ts` – tax calculation (if enabled).
    - `email.service.ts` – email dispatch via Resend with brand theming.
    - `pdf/receiptPdf.service.ts` – receipt PDF generator.
    - `observability.service.ts`, `log.service.ts`, etc.
- `Server/src/jobs/*`
    - `payouts.job.ts` – daily vendor payout scheduler.
- `Server/src/sockets/*`
    - Auction tickers, emitters, and modules wired to Socket.IO.

---

## Stripe & payments

### High-level payment model

MineralCache uses the **Stripe “separate charges & transfers”** pattern:

1. The **platform** (MineralCache) creates a **PaymentIntent** on its own Stripe account and collects the **full order total** (items + shipping + tax).
2. Funds settle into the **platform’s Stripe balance**.
3. Separately, when conditions are met (e.g. order delivered + safety window), the platform creates **Stripe Transfers** to send each vendor their **net** earnings.
4. Whatever remains in the platform’s balance is **MineralCache’s commission** and is paid out to the platform’s own bank account on Stripe’s normal payout schedule.

No direct “destination charges” or app fees are used; all routing is via Transfers from the platform’s collected funds.

### Stripe Connect (vendors)

For each vendor:

- The `Vendor` model stores:
    - `stripeAccountId`
    - `stripeChargesEnabled`
    - `stripePayoutsEnabled`
    - `stripeDetailsSubmitted`
    - `stripeRequirementsDue`
    - `stripeLastSyncAt`
- `stripe.service.ts` exposes helpers:
    - `ensureVendorStripeAccount(...)` – creates or reuses an Express Connect account for the vendor, requesting the `transfers` capability.
    - `createAccountLink(...)` – generates an onboarding link for Stripe-hosted onboarding.
    - `createVendorTransfer(...)` – creates a Stripe Transfer from the platform balance to a vendor’s Connect account.
    - `verifyStripeWebhook(...)` – verifies webhook signatures using `STRIPE_WEBHOOK_SECRET`.

On the API side:

- Vendors can request an onboarding link via:
    - `POST /api/vendors/me/stripe/link`
- Vendors can sync their Connect status:
    - `POST /api/vendors/me/stripe/sync`

The vendor dashboard surfaces whether payouts are enabled and provides a button to “Connect Stripe” or “Update payout details.”

### Checkout & order capture

**Client flow:**

- The client calls a backend endpoint under `/api/checkout/intent` to create a Stripe PaymentIntent.
- The API returns the `client_secret`.
- The React checkout page uses:
    - `@stripe/react-stripe-js` + `CardElement` to collect payment details.
    - `stripe.confirmCardPayment(clientSecret, ...)` to confirm the payment.

**Server flow:**

- Payment Intents are created on the platform account with:
    - `amount` = total order cost in cents.
    - `currency` = currently `usd`.
    - `metadata` including order IDs, user IDs, etc.

**Webhooks:**

- Stripe sends events to `/api/webhooks/stripe`.
- `stripe.controller.ts`:
    - Verifies the event with `verifyStripeWebhook`.
    - On `payment_intent.succeeded` / checkout completed:
        - Marks the matching `Order` as paid.
        - Archives purchased `Product`s and finalizes any `AuctionLock`s for the winning buyer.
        - Calls `materializeOrderVendorMoney(orderId)` to snapshot per-vendor amounts into `OrderVendor`.
        - Sends an `order_paid` email to the buyer (via Resend).
        - Persists webhook events in `WebhookEvent` for observability.

### Vendor payouts (“Delivered + 3 days”)

Payout timing is implemented entirely in the backend:

1. **When the buyer pays**:
    - `materializeOrderVendorMoney(orderId)` calculates, for each `(orderId, vendorId)` pair:
        - `vendorGrossCents` – vendor’s share of line items + allocated shipping.
        - `vendorFeeCents` – commission fee.
        - `vendorNetCents` – what the vendor will eventually receive.
    - These are stored in the `OrderVendor` table with:
        - `payoutStatus = 'pending'`.

2. **When the vendor (or admin) marks items as delivered**:
    - `orders.controller.ts` → `markDelivered`:
        - Marks matching `OrderItem` rows with `deliveredAt`.
        - For each vendor on the order:
            - Checks if **all of that vendor’s items** are delivered.
            - If so, computes `latestDelivered` across that vendor’s items and sets:
                - `holdUntil = latestDelivered + 3 days` (this can be toggled in code; during dev it may be temporarily `now`).
                - `payoutStatus = 'holding'`.

3. **Nightly Stripe Transfers**:
    - `jobs/payouts.job.ts` → `processEligiblePayouts()`:
        - Runs on a scheduler window (e.g. around 9pm America/Chicago).
        - Finds all `OrderVendor` rows where:
            - `payoutStatus = 'holding'`, and
            - `holdUntil <= now`, and
            - Order is fully paid.
        - Groups them by `vendorId`.
        - For each vendor:
            - Skips if no `stripeAccountId` or `stripePayoutsEnabled` is false.
            - Sums `vendorNetCents` across eligible rows.
            - Calls `createVendorTransfer(...)` to create a Stripe Transfer for that total.
            - On success:
                - Sets `payoutStatus = 'transferred'`.
                - Stores `transferId`.
            - On failure:
                - Logs a `stripe_transfer_failed` reason for later troubleshooting.
    - Admins can also manually trigger a run via an admin-only endpoint.

4. **Vendor payouts page**:
    - `Client/src/pages/vendor/VendorPayoutsPage.tsx` calls:
        - `GET /api/vendors/me/payouts?start=YYYY-MM-DD&end=YYYY-MM-DD`
    - The API returns:
        - Per-order lines with:
            - `orderId`, `paidAt`, `status`
            - `vendorGrossCents`, `vendorFeeCents`, `vendorNetCents`
            - `payoutStatus` (`pending`, `holding`, `transferred`, `reversed`)
        - Aggregated `unpaidTotals`, `paidTotals`.
    - The UI shows:
        - “Current balance” (unpaid net total).
        - Running totals for gross, fee, net.
        - Payout status labels (`Pending`, `Queued`, `Paid`, `Reversed`).

These steps together mean **Stripe handles the actual movement of money**, and the app only decides **when** funds should be released based on delivery + safety window rules.

---

## Vendor lifecycle (end-to-end)

This is the full story of a vendor in MineralCache:

1. **Apply**
    - User creates an account.
    - Navigates to `VendorApply` page to submit an application (name, slug, bio, logo, etc.).
    - Data is validated with Zod and stored in the `Vendor` model with an `approvalStatus`.

2. **Approval**
    - Admin reviews applications on `AdminVendorApps` (under `pages/admin`).
    - Admin can approve or reject vendors and set optional commission overrides.

3. **Connect Stripe**
    - Vendor goes to their dashboard.
    - Clicks “Connect Stripe” or similar, which calls:
        - `POST /api/vendors/me/stripe/link`.
    - Backend:
        - Ensures there is a Connect Express account (`ensureVendorStripeAccount`).
        - Uses `stripe.accountLinks.create` to generate an onboarding link.
    - Vendor is redirected to Stripe’s onboarding flow to fill in KYC and bank details.
    - After returning, vendor (or page load) calls:
        - `POST /api/vendors/me/stripe/sync` to refresh status flags.

4. **List products**
    - Vendor uses:
        - `VendorProductsPage` / `ProductCreate` / `ProductEdit` to manage inventory.
    - Images are uploaded via `multer` and processed with `sharp`.
    - Products are associated to categories and stored in `product`, `productImage`, `productCategory`.

5. **Buyers purchase**
    - Buyers browse the catalog / auctions, add items to their cart.
    - For checkout:
        - Backend:
            - Computes shipping using `shipping.service.ts` and vendor shipping rules.
            - Optionally computes tax via `tax.service.ts` and admin settings.
            - Calculates totals for the order.
        - Stripe:
            - A PaymentIntent is created on the platform account.
            - The client confirms via Stripe.js.

6. **Order captured**
    - On successful payment (webhook):
        - The `Order` is marked paid and enriched with totals.
        - `materializeOrderVendorMoney` writes one `OrderVendor` row per vendor on that order:
            - Locking in `vendorGrossCents`, `vendorFeeCents`, `vendorNetCents`.
        - If items were in auctions, associated `AuctionLock`s are finalized and products protected from further purchase.
        - Buyer receives an `order_paid` email and can view a receipt and PDF.

7. **Fulfillment & delivery**
    - Vendor sees the new order in their `VendorOrdersPage`.
    - Vendor updates shipping info (carrier + tracking).
    - Vendor marks items as shipped/delivered when appropriate.
    - When all items for a vendor on an order are delivered:
        - `OrderVendor` is updated to `payoutStatus = 'holding'` with `holdUntil = latest(deliveredAt) + 3 days`.

8. **Payout**
    - Nightly job:
        - Picks up all eligible `OrderVendor` rows (`holding` and `holdUntil <= now`).
        - Sums net amounts per vendor.
        - Sends Stripe Transfers to each vendor’s Connect account.
        - Marks rows as `transferred`.
    - Vendors can see:
        - Per-order payouts and statuses.
        - Their current unpaid balance and paid totals.

9. **Refunds & adjustments (high level)**
    - The backend includes support for refunds and status propagation across:
        - `Order`, `OrderItem`, `OrderVendor`, and Stripe charges.
    - If an order is refunded, corresponding vendor amounts can be reversed or excluded from payouts (depending on business rules).

---

## Data model (high level)

Key tables/models:

- **Users & access**
    - `User` – accounts, roles, auth.
    - `PasswordReset` – one-time reset tokens.
    - `UserAgreement` – which legal docs each user has accepted.

- **Catalog**
    - `Product`, `ProductImage`
    - `Category`, `ProductCategory` (many-to-many)
    - `ShippingRule`, `ShippingRuleTier` – per-vendor shipping config.

- **Cart & orders**
    - `Cart` – cart contents per user/session.
    - `Order` – one per purchase.
    - `OrderItem` – line items per order.
    - `OrderVendor` – per-order, per-vendor accounting snapshot (gross, fee, net, payout status).

- **Auctions**
    - `Auction`
    - `Bid`
    - `AuctionLock` – prevents double-sale while payment is pending.
    - `AuctionWatchlist` – users following auctions.

- **Payouts & admin**
    - `AdminSettings` – commission, tax, brand, and policy knobs.
    - `WebhookEvent` – recorded Stripe webhook events for auditing/diagnostics.

---

## Configuration & environment

### Server env (non-exhaustive)

- **Database**
    - `DATABASE_URL` – standard Postgres connection URI (preferred).
    - or:
        - `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_NAME`.

- **Stripe**
    - `STRIPE_ENABLED` – `true` / `false`; toggles Stripe feature flag.
    - `STRIPE_SECRET_KEY` – Stripe secret key for the platform account.
    - `STRIPE_WEBHOOK_SECRET` – webhook signing secret.

- **Email / brand**
    - `EMAIL_ENABLED` – turn transactional email on/off.
    - `RESEND_API_KEY` – Resend API key.
    - `BRAND_NAME` – brand string used in emails (defaults to “Mineral Cache”).
    - `EMAIL_FROM` – default from address.

- **Tax & currency**
    - `TAX_ENABLED`
    - `TAX_RATE_BPS` – basis points, e.g. `800` = 8.0%.
    - `TAX_LABEL` – label for the tax line (e.g. “Sales tax”).
    - `CURRENCY` – currently `usd`.

- **Shipping defaults**
    - `SHIP_FLAT_CENTS`
    - `SHIP_PER_ITEM_CENTS`
    - `SHIP_FREE_THRESHOLD_CENTS`
    - `SHIP_HANDLING_CENTS`

- **Commissions**
    - `GLOBAL_COMMISSION_PCT` – default commission percentage (e.g. `0.08` for 8%).
    - `GLOBAL_MIN_FEE_CENTS` – minimum fee per vendor per order (e.g. 75 cents).

### Client env

The client is generally configured to talk to the backend on the same origin via `/api/...`. If you deploy the client separately, you can introduce `VITE_API_BASE` and proxy requests accordingly, but by default it assumes a single origin.

---

## Running the project locally

### Prerequisites

- Node.js (LTS 18+)
- PostgreSQL
- A Stripe account with test keys.
- Optional: Resend account for email testing.

### Install dependencies

From the repo root:

```bash
npm install
```

The root `install` script will install dependencies in both `Server` and `Client`.

### Database setup

1. Ensure your Postgres is running.
2. Set `DATABASE_URL` (or `DB_*` vars) in `Server/.env`.
3. From the root, run:

```bash
npm run migrate
```

For dev you can also use the Server scripts directly:

```bash
cd Server
npm run db:migrate
```

(Optional) You can use the `seed:*` scripts if you later introduce seed data, but the current workflow prefers real data created via the UI/API.

### Stripe & webhooks

In `Server/.env`:

```bash
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use `stripe listen` in dev to forward webhooks to your local server and set `STRIPE_WEBHOOK_SECRET` accordingly.

### Start dev servers

From the repo root:

```bash
npm run dev
```

This runs:

- `Client` on Vite (default: `http://localhost:5173`)
- `Server` on Express (default: `http://localhost:3000` or similar), with `/api/...` routes, webhooks, and Socket.IO.

Navigate to the client URL to access the app.

---

## Planned / in-progress areas

While the repo is already quite full-featured, some areas are explicitly structured for ongoing iteration:

- Fine-tuning of commission logic, including per-vendor overrides and admin settings.
- Additional controls and dashboards for admins (advanced reporting, refund tools, dispute handling, etc.).
- More robust fraud/risk checks around payouts (e.g. extended holds for new vendors).
- Marketing content, SEO polish, and public landing material.
- Deployment scripts and infra automation (Render, Fly.io, etc.) beyond simple manual deployment.

---

If you’re reading this in the repo, you can treat this README as the canonical “what is this project and how does it move money?” document for **MineralCache**.
