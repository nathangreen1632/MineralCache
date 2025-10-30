import { Resend } from 'resend';
import { AdminSettings } from '../models/adminSettings.model.js';

type EmailKind =
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'bid_placed'
  | 'bid_leading'
  | 'bid_won';

export type EmailAddress = { name?: string | null; email: string };

export type OrderEmailContext = {
  orderId: number;
  orderNumber?: string | null;
  buyer: EmailAddress;
  itemsBrief?: string;
  trackingUrl?: string | null;
  carrier?: string | null;
  subtotalCents?: number | null;
  shippingCents?: number | null;
  taxCents?: number | null;
  totalCents?: number | null;
};

export type OtpContext = {
  to: EmailAddress;
  code: string;
  minutes: number;
};

export type BidEmailContext = {
  to: EmailAddress;
  auctionTitle: string;
  amountCents: number;
  productSlug?: string | null;
  auctionId?: number | null;
};

function emailEnabled(): boolean {
  return String(process.env.EMAIL_ENABLED).toLowerCase() === 'true';
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function getBranding() {
  const row = await AdminSettings.findOne({ order: [['id', 'ASC']] });
  const brand = row?.brandName || process.env.BRAND_NAME || 'Mineral Cache';
  const fromEmail = row?.emailFrom || process.env.EMAIL_FROM || 'no-reply@mineralvendors.com';
  return { brand, fromEmail };
}

function formatFromHeader(brand: string, fromEmail: string) {
  return brand + ' <' + fromEmail + '>';
}

function usd(cents: number | null | undefined) {
  const n = typeof cents === 'number' ? cents : 0;
  return '$' + (n / 100).toFixed(2);
}

function subjectFor(kind: EmailKind, brand: string, orderNumber: string | null) {
  const suffix = orderNumber ? ' #' + orderNumber : '';
  if (kind === 'order_paid') return brand + ' receipt' + suffix;
  if (kind === 'order_shipped') return brand + ' order shipped' + suffix;
  if (kind === 'order_delivered') return brand + ' order delivered' + suffix;
  if (kind === 'bid_placed') return brand + ' bid placed';
  if (kind === 'bid_leading') return brand + ' you are the leading bidder';
  if (kind === 'bid_won') return brand + ' you won the auction';
  return brand;
}

function htmlFor(kind: EmailKind, brand: string, ctx: OrderEmailContext) {
  const head =
    '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;line-height:1.5"><h2 style="margin:0 0 12px">' +
    brand +
    '</h2>';
  const foot = '<p style="margin-top:16px;color:#555">Thanks for shopping with ' + brand + '.</p></div>';

  if (kind === 'order_paid') {
    const parts: string[] = [];
    const lines: string[] = [];
    if (ctx.itemsBrief) lines.push('<div style="margin:8px 0">' + ctx.itemsBrief + '</div>');
    if (typeof ctx.subtotalCents === 'number') parts.push('<div>Subtotal: <strong>' + usd(ctx.subtotalCents) + '</strong></div>');
    if (typeof ctx.shippingCents === 'number') parts.push('<div>Shipping: <strong>' + usd(ctx.shippingCents) + '</strong></div>');
    if (typeof ctx.taxCents === 'number') parts.push('<div>Tax: <strong>' + usd(ctx.taxCents) + '</strong></div>');
    if (typeof ctx.totalCents === 'number') parts.push('<div>Total: <strong>' + usd(ctx.totalCents) + '</strong></div>');
    const totals = parts.length ? '<div style="margin-top:8px">' + parts.join('') + '</div>' : '';
    const orderTxt = ctx.orderNumber ? ' for order #' + ctx.orderNumber : '';
    return head + '<p style="margin:0 0 8px">Your payment was received' + orderTxt + '.</p>' + lines.join('') + totals + foot;
  }

  if (kind === 'order_shipped') {
    const t = ctx.trackingUrl ? '<div>Tracking: <a href="' + ctx.trackingUrl + '">' + ctx.trackingUrl + '</a></div>' : '';
    const orderTxt = ctx.orderNumber ? ' #' + ctx.orderNumber : '';
    const items = ctx.itemsBrief ? '<div>' + ctx.itemsBrief + '</div>' : '';
    return head + '<p style="margin:0 0 8px">Your order' + orderTxt + ' has shipped.</p>' + items + t + foot;
  }

  if (kind === 'order_delivered') {
    const orderTxt = ctx.orderNumber ? ' #' + ctx.orderNumber : '';
    const items = ctx.itemsBrief ? '<div>' + ctx.itemsBrief + '</div>' : '';
    return head + '<p style="margin:0 0 8px">Your order' + orderTxt + ' was delivered.</p>' + items + foot;
  }

  return head + '<p style="margin:0">Notification</p>' + foot;
}

async function deliver(to: EmailAddress, from: string, subject: string, html: string) {
  if (!emailEnabled()) return;
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({ from, to: [to.email], subject, html });
}

export async function sendOrderEmail(kind: EmailKind, ctx: OrderEmailContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const subject = subjectFor(kind, brand, ctx.orderNumber ?? null);
  const html = htmlFor(kind, brand, ctx);
  const fromHeader = formatFromHeader(brand, fromEmail);
  await deliver(ctx.buyer, fromHeader, subject, html);
}

export async function sendOtpEmail(ctx: OtpContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const fromHeader = formatFromHeader(brand, fromEmail);
  const subject = brand + ' password reset code';
  const html =
    '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;line-height:1.5">' +
    '<h2 style="margin:0 0 12px">' +
    brand +
    '</h2>' +
    '<p style="margin:0 0 8px">Use this code to reset your password:</p>' +
    '<div style="font-size:24px;font-weight:700;letter-spacing:2px">' +
    ctx.code +
    '</div>' +
    '<p style="margin:12px 0 0;color:#555">This code expires in ' +
    String(ctx.minutes) +
    ' minutes.</p>' +
    '</div>';
  await deliver(ctx.to, fromHeader, subject, html);
}

export async function sendBidEmail(kind: 'bid_placed' | 'bid_leading' | 'bid_won', ctx: BidEmailContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const fromHeader = formatFromHeader(brand, fromEmail);
  const subject = subjectFor(kind as EmailKind, brand, null);
  const amount = usd(ctx.amountCents);
  let link: string | null = null;
  if (ctx.productSlug) link = 'https://mineralcache.com/auctions/' + ctx.productSlug;
  else if (ctx.auctionId) link = 'https://mineralcache.com/auction/' + String(ctx.auctionId);
  const linkHtml = link ? '<p><a href="' + link + '">View auction</a></p>' : '';
  let lead = '';
  if (kind === 'bid_placed') lead = 'Your bid was placed.';
  if (kind === 'bid_leading') lead = 'You are the leading bidder.';
  if (kind === 'bid_won') lead = 'You won the auction.';
  const html =
    '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;line-height:1.5">' +
    '<h2 style="margin:0 0 12px">' +
    brand +
    '</h2>' +
    '<p style="margin:0 0 8px">' +
    lead +
    '</p>' +
    '<div>' +
    ctx.auctionTitle +
    ' — <strong>' +
    amount +
    '</strong></div>' +
    linkHtml +
    '</div>';
  await deliver(ctx.to, fromHeader, subject, html);
}
