# Week 7 Checklist — Mineral Cache
_Date range: Oct 20–27, 2025 (America/Chicago)_

> Assumption: Week 6 items are functionally complete (auctions MVP, guest cart merge, 18+ gating, legal modal). This plan drives polish, scalability, and public launch readiness.

## Objectives
- Stabilize auctions for GA with deterministic math and better UX signals.
- Ship vendor-facing profile pages and finalize onboarding handoff.
- Harden catalog/search, performance, and media pipeline for real inventory scale.
- Publish missing legal docs and wire them into the acceptance modal.
- Add observability, QA matrix, and a crisp release checklist.

---

## 1) Auctions GA Polish
- [ ] Enforce canonical bid math at ladder boundaries
    - [ ] Unit tests for min next bid, proxy vs proxy, proxy vs exact, and clearing price
    - [ ] Cap edge-case floating deltas using integer cents end-to-end
    - [ ] Verify anti-sniping extension window is applied exactly once per last-minute bid
- [ ] UX & sockets
    - [ ] Surface “time extended” toast and inline badge on lot detail
    - [ ] Countdown remains monotonic under extensions; no flicker on reconnect
    - [ ] Broadcasts: `auction:high-bid`, `auction:time-extended`, `auction:ended` always include vendorSlug and product slug
- [ ] Admin/vendor controls
    - [ ] Close/cancel permissions verified; audit log writes on close/cancel
    - [ ] Lot health widget: current bid, next min, bids count, unique bidders
- [ ] Observability
    - [ ] Trace IDs on bid lifecycle; sample 100% in non-prod
    - [ ] Metrics: bids/minute, extensions/hour, avg time-to-clear

## 2) Vendor Onboarding → Public Profiles
- [ ] Make vendor application field rules fully mandatory except Bio
- [ ] Persist and display Logo URL on `VendorMainPage` post-approval
- [ ] Public vendor page: `/vendors/:vendorSlug`
    - [ ] Hero (logo, name), About, policies, and social links
    - [ ] Tabs: Products, Auctions, On Sale
    - [ ] Server pagination + SEO-friendly canonical URLs
- [ ] Admin approves → publish toggle (soft unpublish supported)
- [ ] Acceptance: submit application end-to-end; upon approval, data renders publicly

## 3) Catalog & Search Quality
- [ ] Vendor search: normalize by slug OR name (e.g., “one-guy-productions” == “one guy productions”)
- [ ] Fix vendorSlug rendering on `HomePage.tsx` product cards
- [ ] Filters: species, synthetic, price range, vendor, sale window
- [ ] On-sale badge only during active sale window
- [ ] Empty-state and loading skeletons refined for infinite scroll
- [ ] Index sanity: trigram indexes present on `products.name`, `products.vendorSlug`

## 4) Media Pipeline & Limits
- [ ] Enforce new defaults everywhere: 6 images/listing, 20 MB total batch size
- [ ] Client preflight validation mirrors server rules (same MIME allowlist)
- [ ] Derivatives: square thumb, card, detail, retina
- [ ] Sort & primary image selection is preserved across edit sessions
- [ ] Alt text field per image; expose in UI for a11y + SEO
- [ ] Failure cases elevate precise errors (file too large, too many files, invalid type)

## 5) Cart, Checkout & Shipping
- [ ] Guest cart → server cart merge metrics captured
- [ ] Per-vendor shipping rules cover all real vendors; no `shipping.no_rule_fallback` in logs
- [ ] Commission preview visible only to vendors/admin in checkout
- [ ] Stripe on/off paths verified; taxes labeled and included in the intent amount
- [ ] Multi-vendor order breakdown verified in order snapshots

## 6) Legal & Compliance
- [ ] Draft and publish: Data Processing Agreement (DPA)
- [ ] Draft and publish: Disclaimer Policy
- [ ] Draft and publish: Security Policy
- [ ] Draft and publish: Returns & Refunds Policy
- [ ] Wire new docs to the legal modal & footer; capture acceptance version/hash
- [ ] Regenerate `/legal` index page with pills linking to each HTML doc

## 7) Performance & SEO
- [ ] First-load improvements
    - [ ] Code-split heavy pages (auctions detail, vendor pages, checkout)
    - [ ] Preload critical fonts; preconnect to Stripe when enabled
- [ ] Image loading
    - [ ] `loading="lazy"` and `fetchpriority` for hero images
    - [ ] WebP/AVIF served when supported
- [ ] SEO
    - [ ] Sitemap + robots.txt
    - [ ] Open Graph & Twitter cards for products, auctions, and vendor pages
    - [ ] Canonical URLs on paginated and filtered lists

## 8) Accessibility (baseline)
- [ ] Accessible names on actionable controls (filters, add-to-cart, bid)
- [ ] Focus management on route and modal transitions
- [ ] Color contrast meets WCAG AA with project tokens
- [ ] Keyboard-only flows verified for checkout and bidding

## 9) Observability & Ops
- [ ] Structured logs include `requestId`, `userId` (if present), `vendorSlug`
- [ ] Alerting for bid failures, payment intent errors, and image processing errors
- [ ] Ship a redaction pass for logs to avoid leaking PII
- [ ] Health endpoint extends with storage and DB checks used by uptime monitors

## 10) QA Matrix (happy + edge cases)
- [ ] Auctions: last-minute bidding, overlapping proxies, extension race
- [ ] Cart merge: guest→login with overlapping SKUs, multi-vendor scenarios
- [ ] Media: large batch, mixed formats, invalid MIME, reordering persistence
- [ ] Checkout: Stripe off/on, network retry, expired card, 3DS flow
- [ ] Legal: missing acceptance forces modal; acceptance persists & unlocks flow
- [ ] A11y: keyboard-only across critical funnels

## 11) Release Checklist
- [ ] ENV verified (Stripe keys, uploads path, session secret, CORS off as per rule)
- [ ] Admin: shipping rules configured for each live vendor
- [ ] Seed: at least one featured auction and a handful of live products
- [ ] Footer links to all legal docs and vendor directory
- [ ] Rollout plan: enable auctions feature flag after smoketest
- [ ] Post-release dashboard: traffic, bids/min, error budget, 95p LCP

---

### Deliverables
- [ ] PRs: Auctions GA polish, Vendor profiles, Catalog/search, Media & a11y, Legal docs, Observability
- [ ] Docs: updated README deploy section, `/docs/` for ops runbooks and QA scripts
- [ ] Demo script for stakeholders covering vendor → public profile → auction → checkout
