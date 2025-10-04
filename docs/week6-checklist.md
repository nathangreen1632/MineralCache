# MineralCache — Week 6 Backlog Report

> **Note:** This backlog reflects the **agreed scope** and decisions captured up to now.  
> Stripe keys are not yet available; international shipping is deferred; marketplace is **domestic only** for now.  
> Admins: You, Felicia, and (optionally) developer. Hosting target: **Render**. Storage: **Render Disk 50–100GB** for photos, move to S3/R2 later. No CORS (frontend proxies API).

---

## Business/Policy Snapshot (for context)
- **Commission:** Global default **8%** with **$0.75 min fee**; per‑vendor overrides allowed (power sellers/promos).
- **Payout timing:** On **shipment** or **delivery** confirmation (not immediate).
- **Refunds/chargebacks:** **Vendor** bears the cost/fees.
- **Accounts:** Buyer & Vendor; **manual vendor approval**.
- **Age rule:** **18+** to buy/bid; if underage discovered → removal.
- **Checkout:** **Single multi-vendor checkout**; per‑vendor shipping rates (flat for now).
- **Sales tax:** Start with **Stripe Tax (US only)**; int’l phase later.
- **Auctions:** Durations **1/3/5/7d**; **Buy It Now** allowed; **anti‑sniping** (+3 min) per last bid; **proxy bidding**; optional **reserve** (nice-to-have).
- **Catalog fields (minerals):** species, locality, size (cm), weight (g), fluorescence, condition, provenance, **synthetic/lab‑grown (yes/no)**, on‑sale (compareAt/price).
- **Photo policy:** ≤ **4 images**, total ≤ **10MB**; allowed: **webp/png/jpeg/jpg**; thumbs & large previews.
- **Brand:** **MineralCache**; clean/elegant UI (dark-friendly), minimal promos.

---

## Where we should be by Week 6 (high level)
- **Vendor Onboarding** (MVP) complete: apply → manual approve/reject → Stripe Connect onboarding link (graceful when Stripe disabled).
- **Products & Photos**: Vendor CRUD; required mineral attributes; upload pipeline with derivatives; public catalog browse/detail with filters.
- **Cart & Checkout**: Server‑side cart + totals (per vendor shipping); PaymentIntent creation when Stripe enabled; 18+ enforced.
- **Auctions (phase‑1 usable)**: create/list/detail; bid engine (increments & proxy); live updates via Socket.IO; anti‑sniping.
- **Admin**: vendor apps, basic product moderation, config readout (fees, shipping), audit fields for approvals.
- **Ops**: migrations & seeds; health/ready; CI builds; basic rate limits; logs; error hygiene (no unhandled throws).

---

## Week 6 Objectives (actionable checklist)

### 1) Auctions — Server
- [ ] **Models & Migrations**: `auctions`, `bids`, `auction_photos` (if separate), `watchlist`.
    - Fields: startPrice, buyNowPrice (optional), vendorId, productRef or inline fields, startAt, endAt, status; reserve (optional flag), increment ladder.
    - Bid: userId, amountCents, **maxProxyCents**, createdAt.
- [ ] **Rules**: increments per tiers (e.g., 10–50=$5; 51–500=$10; 501–1000=$25; 1001–5000=$50; 5001–10000=$100; 10001–25000=$250; 25001+=$500).
- [ ] **Proxy bidding**: raise current price up to winner’s `maxProxyCents`; store losing proxy safely.
- [ ] **Anti‑sniping**: If bid in last X min (**3 min**), extend `endAt` by 3 mins.
- [ ] **Endpoints** (flat routes): list, get, create (vendor), placeBid, buyNow, cancel/close (vendor/admin).
- [ ] **Sockets**: join room `a:<built-in function id>`, broadcast `bid-placed`, `price-updated`, `time-extended`, `closed`.
- [ ] **Guards**: auth + **18+** for bid/buy; vendor ownership for create/close; no throws—return JSON errors.

### 2) Auctions — Client
- [ ] **Create/Edit Auction** page (vendor): set durations (1/3/5/7d), start price, BIN optional; preview end time.
- [ ] **Auction Detail**: bidding UI (current price, time remaining, place bid, set max proxy), auto‑refresh via sockets.
- [ ] **List/Discover**: browse auctions with filters (vendor, species, synthetic) and sort (ending soon, newest).
- [ ] **Notifications**: light toast updates on bid acceptance/outbid.

### 3) Products & Photos (complete polish)
- [ ] **Migrations/Models**: `products`, `product_images` (with order index).
- [ ] **Upload pipeline**: `multer.memoryStorage` → validation (≤10MB total, ≤4 images, MIME) → `sharp` derivatives (e.g., 320, 800, 1600) → write to Render disk (`/uploads/...`). Cache headers set.
- [ ] **Vendor CRUD**: create/update/archive product; toggle **onSale** with `compareAt` and badge.
- [ ] **Public Catalog**: list (filters: vendor, species, synthetic, onSale), detail page with gallery and attributes.

### 4) Cart & Checkout
- [ ] **Persistent cart** (table keyed by userId). Merge on login.
- [ ] **Totals**: server computes subtotal + **per‑vendor flat shipping**; include commission preview (owner-facing only).
- [ ] **Checkout**: If Stripe disabled → friendly 503 JSON; else create PaymentIntent (amountCents from server totals).
- [ ] **Age Gate**: ensure `/auth/verify-18` is wired in UI (banner/modal).

### 5) Vendor Onboarding & Admin
- [ ] **Vendor dashboard**: shows application status, Stripe onboarding button when approved & keys present.
- [ ] **Admin vendor apps**: pagination, search by name, **audit fields** (`approvedBy`, `approvedAt`, optional `rejectedReason`).
- [ ] **Config read endpoint**: expose 8% + $0.75, shipping defaults (read‑only; source env or config table).

### 6) Observability, Safety, CI
- [ ] **Rate limits/backoff**: login endpoint, uploads.
- [ ] **Structured errors**: all controllers return JSON; no `throw new Error`; no nested ternaries.
- [ ] **Health/Ready**: already present—add `/api/version` (git SHA) if available.
- [ ] **CI**: ensure Server+Client build on push/PR; run lint/typecheck.

---

## Risks / Decisions Needed
- **Stripe keys pending**: keep all Stripe flows **gracefully disabled** until keys arrive.
- **International**: deferred; tax & shipping logic scoped to US only.
- **Reserve price**: allowed later; **not required** for week 6 MVP.
- **Render disk limits**: watch usage; plan S3/R2 migration when photos grow.
- **Search performance**: add DB indexes for vendorId, species, createdAt, onSale.

---

## Suggested DB Checklist
- [ ] `vendors`: +audit fields (`approvedBy`,`approvedAt`,`rejectedReason`), fee overrides.
- [ ] `products`: vendorId FK, mineral attributes, onSale/compareAt, status.
- [ ] `product_images`: productId FK, url/path, width/height, order.
- [ ] `auctions`: vendorId FK, productId FK (or inline), pricing & times, status.
- [ ] `bids`: auctionId FK, userId FK, amount, maxProxy, outbidAt.
- [ ] `carts` & `cart_items`: userId FK, per‑vendor split stored for totals.
- [ ] Indexes: (`products.vendorId`), (`products.species`), (`auctions.endAt`), (`bids.auctionId, createdAt`).

---

## QA & UAT
- [ ] Vendor apply/update round‑trip.
- [ ] Admin approve → onboarding link behavior (with/without Stripe).
- [ ] Product create with 4 photos (10MB total)—derivatives visible.
- [ ] Catalog filters + onSale badge.
- [ ] Cart totals with multiple vendors.
- [ ] Auction anti‑sniping (manual clock test), proxy bid correctness.
- [ ] 18+ gate blocks bid/checkout until verified.

---

## Deployment Notes
- Env: `DATABASE_URL`, `SESSION_SECRET`, optional `STRIPE_SECRET_KEY`, `PLATFORM_URL`, `UPLOADS_DIR`.
- Render: map persistent disk to `/var/data/uploads`; ensure static serving `/uploads/*` from API.
- Rollbacks: maintain migrations; seed minimal fixtures for demo (admin + vendor + products + one auction).

---
