# MineralCache – Non‑Technical Overview

> This document explains **what MineralCache is and how it works** in plain language.  
> It’s meant for normal humans, not programmers.

---

## What is MineralCache?

MineralCache is an online **marketplace** dedicated to:

- Minerals and crystals
- Fossils
- Gemstones and jewelry stones
- Related collectibles and natural history pieces

Think of it as a focused version of a big marketplace site, but built **specifically for mineral and fossil people**:

- Serious collectors
- New hobbyists
- Professional dealers and vendors

Everyone uses the same website, but they each see the tools and pages that matter to them.

---

## Who uses MineralCache?

### 1. Buyers and collectors

Buyers come to MineralCache to:

- Browse and search for pieces by **category**, **price**, or **keywords**
- Discover new **vendors** and **collections** they didn’t know about
- Buy items at a fixed price
- Bid in **auctions** on higher‑end or rare pieces
- Track orders, shipping, and delivery from their account
- Download receipts and keep their purchase history organized

### 2. Vendors (sellers / dealers)

Vendors use MineralCache to:

- Apply to become an approved seller
- Set up a **vendor profile** with their name, logo, description, and location
- List items for sale with photos, titles, descriptions, and prices
- Set shipping rules and options that match their business
- See incoming orders, mark items as shipped or delivered, and manage their side of the sale
- Get paid automatically through **Stripe**, a major online payment company

### 3. Admins (site operators)

Admins run the platform. In simple terms, they:

- Review and approve vendor applications
- Keep an eye on orders and payouts
- Adjust commissions, fees, and global settings
- Maintain the legal documents and policies
- Help resolve issues if something goes wrong

---

## What you can do on the site

### As a visitor

Without an account, you can:

- Browse categories like minerals, fossils, gemstones, and more
- View product and auction detail pages
- See vendor profiles and what they sell
- Read the legal pages (Terms of Service, Privacy Policy, etc.)

### As a buyer (once you sign up)

With an account, you can:

- Add items to your **cart**
- Bid on **auctions**
- Check out and pay using a secure card form
- See your **order history**
- View detailed order pages:
    - Items you bought
    - Prices and totals
    - Shipping address and tracking
    - Order status (paid, shipped, delivered)
- Download a **PDF receipt** for your records
- Receive email notifications when:
    - Your order is paid
    - Your order is shipped
    - Your order is marked delivered

### As a vendor

Vendors, once approved, get extra features:

- A **vendor dashboard**, where they can:
    - See their **sales and orders**
    - Update tracking and shipping information
    - Mark orders as **shipped** and **delivered**
    - View their **payout history** and current balance

- A **product management area**, where they can:
    - Create new listings
    - Upload photos and descriptions
    - Edit or unlist existing products
    - (Where enabled) create and manage auctions

---

## How payments work (in plain English)

MineralCache uses **Stripe** to handle card payments and vendor payouts.

Stripe is a large, well‑known payment company that also powers payments for many major online services. When you pay on MineralCache, your card details are handled by Stripe, not by MineralCache’s own servers.

### For buyers

1. You add items to your cart and click **Checkout**.
2. On the checkout page, you enter your:
    - Name
    - Shipping address
    - Card details (handled securely by Stripe)
3. When you confirm:
    - Stripe charges your card.
    - The charge appears on your statement under MineralCache’s name or similar.
4. You see an order confirmation and get a confirmation email.
5. You can always come back and view your order details and receipt.

### For vendors

Behind the scenes, this is what happens when someone buys from a vendor:

1. When the buyer pays, the **full amount** goes into MineralCache’s Stripe account.
2. MineralCache calculates exactly how much each vendor should receive for that order:
    - Product prices for that vendor
    - Their share of shipping (if applicable)
    - The platform’s **commission fee**
3. For each vendor on the order, the system stores:
    - Gross amount (what the buyer effectively paid to that vendor)
    - Commission fee (MineralCache’s take)
    - Net amount (what the vendor should eventually receive)

At this stage, the money is **reserved** for the vendor but **not paid out yet**.

---

## Why MineralCache holds funds briefly

MineralCache takes buyer and seller safety seriously.

Because of that, there is a short **safety window** between “buyer has paid” and “vendor gets paid out.” This exists to reduce headaches if:

- An item never ships
- Tracking looks suspicious
- There’s a clear mistake on the order

The rule is:

> Vendors are paid **3 days after the order is marked delivered**, not immediately after payment.

That means:

1. The buyer pays.
2. The vendor ships the item and enters tracking information.
3. The vendor marks the order (or items) as **delivered**.
4. Once everything for that vendor is delivered, the system starts a **3‑day timer**.
5. After those 3 days pass, and if everything still looks good, the vendor’s money is released.

---

## How vendor payouts work

### Step 1 – Vendor connects Stripe

To get paid, a vendor needs a **Stripe account** that’s linked to MineralCache. The process:

1. From the vendor dashboard, they click a **“Connect with Stripe”** type button.
2. They are taken to Stripe’s **onboarding page**, where they fill in:
    - Legal name or business name
    - Address and contact information
    - Bank account details
    - Any additional identity verification Stripe requires
3. When they finish, Stripe redirects them back to MineralCache.
4. MineralCache checks with Stripe and saves:
    - The vendor’s Stripe account ID
    - Whether payouts are allowed
    - Whether anything is still missing (for example, if Stripe still needs more documents)

If Stripe says a vendor is not ready, MineralCache will not attempt to send them money yet.

### Step 2 – Orders move into a “holding” state

For each order that includes that vendor:

1. Once the order is **fully paid**, the system calculates how much the vendor should earn.
2. Those amounts are recorded in a special internal record (one per vendor per order).
3. When the vendor (or admin) marks all of that vendor’s items on the order as **delivered**, the system:
    - Sets a date/time called **“hold until”** which is:
        - The latest delivery time for that vendor’s items
        - Plus **3 extra days**
    - Marks those funds as **“holding”** for that vendor.

### Step 3 – Automatic nightly payouts

On a regular schedule (for example, once per day in the evening), MineralCache runs a payout job:

1. It looks for all vendor amounts where:
    - The funds are in “holding” status.
    - The **“hold until” date is in the past** (the 3‑day safety window is over).
    - The underlying order is fully paid and not refunded.
2. It groups them by vendor and sums the amounts.
3. For each vendor, it asks Stripe to:
    - Move that **net amount** from MineralCache’s Stripe balance  
      **into the vendor’s Stripe account balance.**
4. If Stripe says “OK”:
    - The system marks those amounts as **paid** for that vendor.
5. If Stripe says “something went wrong”:
    - The system logs a clear reason so admins can follow up.

From there, Stripe will pay the vendor out to their **bank account** on Stripe’s regular **payout schedule** (daily, weekly, etc., depending on the vendor’s Stripe settings). MineralCache doesn’t manually wire or ACH funds—it instructs Stripe to transfer, and Stripe handles the rest.

### Step 4 – Vendor payout history & balances

Vendors can check their **payout page** to see:

- A **running total** of:
    - Gross sales
    - Commission fees
    - Net amounts
- A **current balance**: how much is still waiting to be paid out
- A **history** of past orders and payouts
    - Which orders were included
    - When they were marked as paid to the vendor
    - Whether any amounts were reversed

---

## How MineralCache earns money

MineralCache earns money through a **commission fee**:

- Each order that includes one or more vendors has:
    - A buyer total (items + shipping + taxes, if any)
    - A **platform fee** that MineralCache keeps
    - A **vendor net amount** that belongs to each vendor

The platform fee:

- Helps pay for hosting, development, support, and operations.
- Is taken automatically as part of the payout process:
    - The vendor’s net amount is sent to them.
    - The remaining portion stays in MineralCache’s Stripe balance as revenue.

MineralCache **does not charge buyers separately** for this fee; it’s baked into how the marketplace splits the money behind the scenes.

---

## Orders, shipping, and tracking

### How shipping works

MineralCache supports **per‑vendor shipping rules**, so each vendor can:

- Set a base shipping cost
- Adjust shipping for:
    - Additional items
    - Different weight or order size
- Offer free shipping over a certain amount, if they choose

During checkout:

- The site calculates a combined total that includes:
    - Items from all vendors in the cart
    - Shipping according to each vendor’s rules
- The buyer sees a single clear total and pays once.

### Tracking and delivery

After an order is placed:

- Vendors can enter:
    - Shipping carrier (for example: USPS, UPS, FedEx)
    - Tracking number
- MineralCache can turn this into a direct **tracking link**.
- Buyers see:
    - When the order was shipped
    - The tracking number
    - The delivery status (once marked delivered)

When everything for that vendor is delivered, the **payout countdown** begins (delivered + 3 days).

---

## Auctions

MineralCache supports **auctions** for items where bidding makes more sense than a fixed price.

From a buyer’s perspective:

- You can:
    - Browse auctions
    - Place bids
    - See when an auction starts and ends
    - See if you are the current highest bidder
- When you win:
    - You are given a path to pay for the item.
    - Once paid, the order flows through the same **shipping and payout** pipeline as any other order.

From a vendor’s perspective:

- They can list items as auctions instead of fixed‑price.
- They see bids and final results.
- After the winning buyer pays, the **payout rules** are the same:
    - Delivered + 3 days → automatic vendor payout.

---

## Safety, trust, and legal stuff (in human terms)

### Payments and card safety

- Card details are **never stored directly** on MineralCache’s servers.
- Stripe handles the sensitive card information.
- MineralCache receives only the information it needs to:
    - Confirm payment
    - Fulfill orders
    - Support customer service

### Privacy

MineralCache has:

- A **Privacy Policy** explaining what data is collected and how it’s used.
- A **Cookie Policy** explaining what cookies are used (for things like authentication and analytics).

These documents are written for compliance and clarity. In short:

- The platform stores the information needed to run your account, process orders, and help with support.
- It does not sell your personal data.

### Terms of Service

Before users can fully use the site, they must agree to:

- **Terms of Service** for buyers
- **Additional terms for vendors**, if they are selling on the platform

These explain:

- What is and isn’t allowed on the site
- Who is responsible for what (buyers, vendors, and MineralCache)
- How disputes are handled at a high level

The site keeps track of who has agreed to which documents and when.

---

## In short

MineralCache is:

- A dedicated **marketplace for minerals, fossils, gemstones, and related collectibles**.
- A place where:
    - Buyers can safely discover and purchase unique pieces.
    - Vendors can reach a focused audience and get paid automatically.
- Built around:
    - Clear **order tracking**
    - A fair and transparent **commission model**
    - Automatic **vendor payouts** through Stripe
    - A short **“delivered + 3 days”** safety window to protect both sides.

If you’re a **buyer**, you can think of MineralCache as a curated shop full of mineral and fossil vendors.  
If you’re a **vendor**, you can think of it as your selling platform where payments and payouts are handled for you, so you can focus on sourcing and shipping great pieces.
