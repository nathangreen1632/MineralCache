# Mineral Cache — Week-2 Objectives (Finalized)

## Backend (API)
- **Auth hardening**
    - Zod validation on all auth endpoints
    - Basic login backoff (IP + email)
    - `/auth/logout` and session rotation on login
    - Enforce 18+ on checkout/bids
- **Vendor onboarding MVP**
    - `applyVendor` / `getMyVendor` with slug uniqueness + useful errors
    - Admin list/approve/reject + audit fields (`approvedBy`, `approvedAt`, `rejectedReason`)
- **Stripe plumbing**
    - Graceful-off behavior
    - Webhook stub `/webhooks/stripe` (verify signature only when keys exist)
- **Catalog essentials**
    - Product model + migrations with mineral attributes (species, locality, size, weight, fluorescence, condition, provenance, synthetic, onSale, compareAt)
    - Vendor Product CRUD routes with auth
    - Public catalog read endpoints with filters (vendor, species, synthetic, onSale) and sorting (new, price)
    - Indexes for common filters/search
- **Photos & storage**
    - `multer.memoryStorage` + sharp derivatives (320/800/1600); MIME/size checks (≤10MB total, ≤4 images)
    - Disk adapter paths; static URL mapping + cache headers
    - Basic quota guardrails and clear errors
- **Cart & checkout skeleton**
    - Server-side Cart keyed by userId; `GET/PUT /cart`
    - Compute totals (subtotal + flat-rate shipping per vendor)
    - If Stripe enabled: create PaymentIntent, return `{ clientSecret }`
- **Admin configuration**
    - Read-only config endpoint for commission (8%) + min fee ($0.75) + shipping defaults
    - `/api/version` with git SHA

## Frontend (App UX)
- **Routing & layout**
    - Layout + Navbar globally; simple Home page
- **Vendor application UX**
    - `/vendor/apply` with inline validation, friendly Zod errors, submitted/resubmitted states
    - Admin `/admin/vendor-apps` with pagination, status chips, basic search
- **Product CRUD (vendor)**
    - Create/Edit Product pages with mineral fields + onSale/compareAt
    - Photo uploader (≤4) with previews + derivative sizes after upload
    - Success/error toasts; disable while saving
- **Catalog browse**
    - Public Products page (filters + sort)
    - Product detail (gallery, attributes, vendor link)
- **Cart & checkout**
    - Mini-cart + full cart wired to `GET/PUT /cart`
    - Checkout page: payments unavailable state until Stripe keys/Elements (Week-3)
- **Age gate**
    - Lightweight 18+ confirmation hitting `/auth/verify-18`, blocking bid/checkout until set

## DevOps & Quality
- **Migrations & seeds**
    - Seed admin user, one approved vendor, sample products/images
    - Verify FKs/uniques/indexes (slug, vendorId, species)
- **CI**
    - Ensure Server/Client build passes (workflow in place)
- **Observability & safeguards**
    - Request IDs in logs/responses
    - Rate limits on `/auth/login` and `/uploads/images` (and generic uploads)
    - Consistent JSON errors; no unhandled throws

## Stretch (if time permits)
- **Auction scaffolding**
    - Migrations for auctions & bids; REST stubs (create/list/get/placeBid) with increment ladder & proxy-bid placeholder
    - Socket rooms join/leave + placeholder emits
- **Simple search**
    - Keyword search over product title/species/locality (ILIKE) with pagination
