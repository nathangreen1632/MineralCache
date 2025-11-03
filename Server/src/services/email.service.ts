import { Resend } from 'resend';
import { AdminSettings } from '../models/adminSettings.model.js';
import { logWarn } from './log.service.js';

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
  const fromEmail = row?.emailFrom || process.env.EMAIL_FROM || 'no-reply@mineralcache.com';
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

async function deliver(to: EmailAddress, from: string, subject: string, html: string): Promise<boolean> {
  if (!emailEnabled()) {
    logWarn('email.disabled', { to: to.email, subject });
    return false;
  }
  const resend = getResend();
  if (!resend) {
    logWarn('email.missing_api_key', { to: to.email, subject });
    return false;
  }
  try {
    const result: any = await resend.emails.send({ from, to: [to.email], subject, html });
    if (result?.error) {
      const msg = typeof result.error === 'object' && result.error?.message ? result.error.message : 'unknown';
      logWarn('email.resend_error', { to: to.email, subject, message: msg });
      return false;
    }
    return true;
  } catch (e: any) {
    const msg = e?.message || String(e);
    logWarn('email.send_exception', { to: to.email, subject, message: msg });
    return false;
  }
}

export async function sendOrderEmail(kind: EmailKind, ctx: OrderEmailContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const fromHeader = formatFromHeader(brand, fromEmail);
  const subject = subjectFor(kind, brand, ctx.orderNumber ?? null);
  const site = process.env.PUBLIC_SITE_URL || 'https://www.mineralcache.com';
  const brandLink = '<a href="' + site + '" target="_blank" rel="noopener noreferrer">' + brand + '</a>';

  const light_bg = '#F2EEED';
  const light_card = '#FAFAFA';
  const light_border = '#EDDEDE';
  const light_text = '#300D0D';
  const light_link = '#38302E';
  const light_stripe = '#ECD4CA';
  const light_btn_bg = '#300D0D';
  const light_btn_text = '#FAFAFA';

  const dark_bg = '#040F0F';
  const dark_card = '#122932';
  const dark_border = '#57737A';
  const dark_text = '#FCFCFC';
  const dark_link = '#46ACC2';
  const dark_stripe = '#85BDBF';
  const dark_btn_bg = '#FCFCFC';
  const dark_btn_text = '#040F0F';

  const orderTxt = ctx.orderNumber ? ' #' + ctx.orderNumber : '';

  let preheader = brand + ' order update';
  if (kind === 'order_paid') preheader = 'Payment received' + orderTxt + '.';
  else if (kind === 'order_shipped') preheader = 'Your order' + orderTxt + ' has shipped.';
  else if (kind === 'order_delivered') preheader = 'Your order' + orderTxt + ' was delivered.';

  const lines: string[] = [];
  if (ctx.itemsBrief) lines.push('<div style="margin:8px 0 0 0">' + ctx.itemsBrief + '</div>');

  const totals: string[] = [];
  if (typeof ctx.subtotalCents === 'number') totals.push('<div>Subtotal: <strong>$' + (ctx.subtotalCents / 100).toFixed(2) + '</strong></div>');
  if (typeof ctx.shippingCents === 'number') totals.push('<div>Shipping: <strong>$' + (ctx.shippingCents / 100).toFixed(2) + '</strong></div>');
  if (typeof ctx.taxCents === 'number') totals.push('<div>Tax: <strong>$' + (ctx.taxCents / 100).toFixed(2) + '</strong></div>');
  if (typeof ctx.totalCents === 'number') totals.push('<div>Total: <strong>$' + (ctx.totalCents / 100).toFixed(2) + '</strong></div>');
  const totalsHtml = totals.length ? '<div style="margin-top:10px">' + totals.join('') + '</div>' : '';

  let lead = '';
  if (kind === 'order_paid') lead = 'Your payment was received' + orderTxt + '.';
  else if (kind === 'order_shipped') lead = 'Your order' + orderTxt + ' has shipped.';
  else if (kind === 'order_delivered') lead = 'Your order' + orderTxt + ' was delivered.';

  let statusLabel = 'ORDER UPDATE';
  if (kind === 'order_paid') statusLabel = 'ORDER PAID';
  else if (kind === 'order_shipped') statusLabel = 'ORDER SHIPPED';
  else if (kind === 'order_delivered') statusLabel = 'ORDER DELIVERED';

  let ctaHtml = '';
  if (kind === 'order_shipped' && ctx.trackingUrl) {
    ctaHtml =
      '<p style="margin:16px 0 0 0">' +
      '<a href="' +
      ctx.trackingUrl +
      '" class="btn" style="display:inline-block;background:' +
      light_btn_bg +
      ';color:' +
      light_btn_text +
      ';font-weight:700;padding:12px 16px;border-radius:999px;text-decoration:none">Track package</a>' +
      '</p>';
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en" style="margin:0;padding:0">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <title>${subject}</title>
      <style>
        a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
        .bg-page{background:${light_bg}}
        .card{background:${light_card};border:1px solid ${light_border}}
        .text{color:${light_text}}
        .muted{opacity:.9}
        .link{color:${light_link};text-decoration:underline}
        .stripe{background:${light_stripe}}
        .btn{background:${light_btn_bg};color:${light_btn_text};font-weight:700;padding:12px 16px;border-radius:999px;text-decoration:none}
        @media (prefers-color-scheme: dark){
          .bg-page{background:${dark_bg}!important}
          .card{background:${dark_card}!important;border-color:${dark_border}!important}
          .text{color:${dark_text}!important}
          .link{color:${dark_link}!important}
          .stripe{background:${dark_stripe}!important}
          .btn{background:${dark_btn_bg}!important;color:${dark_btn_text}!important}
        }
        [data-ogsc] .bg-page{background:${dark_bg}!important}
        [data-ogsc] .card{background:${dark_card}!important;border-color:${dark_border}!important}
        [data-ogsc] .text{color:${dark_text}!important}
        [data-ogsc] .link{color:${dark_link}!important}
        [data-ogsc] .stripe{background:${dark_stripe}!important}
        [data-ogsc] .btn{background:${dark_btn_bg}!important;color:${dark_btn_text}!important}
      </style>
    </head>
    <body class="bg-page" style="margin:0;padding:0;background:${light_bg};color:${light_text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;color:transparent">${preheader}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px">
              <tr>
                <td style="padding:0 8px">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="border-radius:16px;overflow:hidden">
                    <tr>
                      <td class="stripe" style="padding:14px 20px">
                        <table role="presentation" width="100%">
                          <tr>
                            <td style="font-size:18px;font-weight:700;color:${light_text};letter-spacing:.3px">${brand}</td>
                            <td align="right" style="font-size:12px;color:${light_text};opacity:.85">${statusLabel}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="text" style="padding:28px 24px 16px 24px">
                        <h2 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;font-weight:700">${subject}</h2>
                        <p class="muted" style="margin:0 0 16px 0;font-size:16px;line-height:1.6">${lead}</p>
                        ${lines.join('')}
                        ${totalsHtml}
                        ${ctaHtml}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 24px 0 24px">
                        <hr style="border:none;height:1px;background:${light_border};opacity:.9" />
                      </td>
                    </tr>
                    <tr>
                      <td class="text" style="padding:14px 24px 24px 24px">
                        <p style="margin:0;font-size:12px;line-height:1.6;opacity:.85">This update was sent from ${brandLink}.</p>
                        <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;opacity:.6">© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  const ok = await deliver(ctx.buyer, fromHeader, subject, html);
  if (!ok) logWarn('email.send_failed', { kind, to: ctx.buyer.email, subject });
}


export async function sendOtpEmail(ctx: OtpContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const fromHeader = formatFromHeader(brand, fromEmail);
  const site = process.env.PUBLIC_SITE_URL || 'https://www.mineralcache.com';
  const brandLink = '<a href="' + site + '" target="_blank" rel="noopener noreferrer">' + brand + '</a>';

  const cleanLeading = (s: string): string =>
    String(s ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/^(?:\s*<(?:br)\s*\/?>)+/i, '')
      .replace(/^(?:&nbsp;|&#160;)+/i, '')
      .replace(/^[\s\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]+/u, '');

  const otpClean = cleanLeading(ctx.code);
  const subject = 'Your OTP Code for ' + brand;
  const preheader = 'Your OTP code is ' + otpClean + '. It expires in ' + String(ctx.minutes) + ' minutes.';

  const light_bg = '#F2EEED';
  const light_card = '#FAFAFA';
  const light_border = '#EDDEDE';
  const light_text = '#300D0D';
  const light_stripe = '#ECD4CA';
  const light_btn_bg = '#300D0D';
  const light_btn_text = '#FAFAFA';

  const dark_bg = '#040F0F';
  const dark_card = '#122932';
  const dark_border = '#57737A';
  const dark_text = '#FCFCFC';
  const dark_stripe = '#85BDBF';
  const dark_btn_bg = '#FCFCFC';
  const dark_btn_text = '#040F0F';

  const html = `
  <!DOCTYPE html>
  <html lang="en" style="margin:0;padding:0">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <title>${subject}</title>
      <style>
        a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
        .bg-page{background:${light_bg}}
        .card{background:${light_card};border:1px solid ${light_border}}
        .text{color:${light_text}}
        .stripe{background:${light_stripe}}
        .otp-box{background:${light_card};border:2px dashed ${light_text};border-radius:12px;padding:18px 16px}
        .otp-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:32px;letter-spacing:6px;line-height:1;color:${light_text};font-weight:800;text-shadow:0 1px 0 rgba(0,0,0,.2)}
        .btn{background:${light_btn_bg};color:${light_btn_text};font-weight:700;padding:12px 16px;border-radius:999px;text-decoration:none}
        @media (prefers-color-scheme: dark){
          .bg-page{background:${dark_bg}!important}
          .card{background:${dark_card}!important;border-color:${dark_border}!important}
          .text{color:${dark_text}!important}
          .stripe{background:${dark_stripe}!important}
          .otp-box{background:#111!important;border-color:${dark_border}!important}
          .otp-text{color:${dark_text}!important;text-shadow:0 1px 0 rgba(0,0,0,.8)!important}
          .btn{background:${dark_btn_bg}!important;color:${dark_btn_text}!important}
        }
        [data-ogsc] .bg-page{background:${dark_bg}!important}
        [data-ogsc] .card{background:${dark_card}!important;border-color:${dark_border}!important}
        [data-ogsc] .text{color:${dark_text}!important}
        [data-ogsc] .stripe{background:${dark_stripe}!important}
      </style>
    </head>
    <body class="bg-page" style="margin:0;padding:0;background:${light_bg};color:${light_text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;color:transparent">${preheader}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
              <tr>
                <td style="padding:0 8px">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="border-radius:16px;overflow:hidden">
                    <tr>
                      <td class="stripe" style="padding:14px 20px">
                        <table role="presentation" width="100%">
                          <tr>
                            <td style="font-size:18px;font-weight:700;color:${light_text};letter-spacing:.3px">${brand}</td>
                            <td align="right" style="font-size:12px;color:${light_text};opacity:.85">Security Notification</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="text" style="padding:28px 24px 10px 24px">
                        <h2 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;font-weight:700">Your One-Time Password (OTP)</h2>
                        <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6">Use the code below to reset your password. This code expires in <strong>${String(ctx.minutes)} minutes</strong>.</p>
                        <table role="presentation" width="100%" style="margin:16px 0 12px 0">
                          <tr>
                            <td align="center" class="otp-box">
                              <div class="otp-text">${otpClean}</div>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;opacity:.9">Didn’t request this? Ignore this email.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 24px 0 24px">
                        <hr style="border:none;height:1px;background:${light_border};opacity:.9" />
                      </td>
                    </tr>
                    <tr>
                      <td class="text" style="padding:14px 24px 24px 24px">
                        <p style="margin:0;font-size:12px;line-height:1.6;opacity:.85">Requested from the login page on ${brandLink}.</p>
                        <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;opacity:.6">© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  const ok = await deliver(ctx.to, fromHeader, subject, html);
  if (!ok) logWarn('email.send_failed', { kind: 'otp', to: ctx.to.email, subject });
}


export async function sendBidEmail(kind: 'bid_placed' | 'bid_leading' | 'bid_won', ctx: BidEmailContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const fromHeader = formatFromHeader(brand, fromEmail);
  const subject = subjectFor(kind as EmailKind, brand, null);
  const site = process.env.PUBLIC_SITE_URL || 'https://www.mineralcache.com';
  const brandLink = '<a href="' + site + '" target="_blank" rel="noopener noreferrer">' + brand + '</a>';
  const amount = usd(ctx.amountCents);

  let link: string | null = null;
  if (ctx.productSlug) link = site.replace(/\/+$/,'') + '/auctions/' + ctx.productSlug;
  else if (ctx.auctionId) link = site.replace(/\/+$/,'') + '/auction/' + String(ctx.auctionId);

  let lead = '';
  if (kind === 'bid_placed') lead = 'Your bid was placed.';
  else if (kind === 'bid_leading') lead = 'You are the leading bidder.';
  else if (kind === 'bid_won') lead = 'You won the auction.';

  const light_bg = '#F2EEED';
  const light_card = '#FAFAFA';
  const light_border = '#EDDEDE';
  const light_text = '#300D0D';
  const light_link = '#38302E';
  const light_stripe = '#ECD4CA';
  const light_btn_bg = '#300D0D';
  const light_btn_text = '#FAFAFA';

  const dark_bg = '#040F0F';
  const dark_card = '#122932';
  const dark_border = '#57737A';
  const dark_text = '#FCFCFC';
  const dark_link = '#46ACC2';
  const dark_stripe = '#85BDBF';
  const dark_btn_bg = '#FCFCFC';
  const dark_btn_text = '#040F0F';

  let cta = '';
  if (link) {
    cta =
      '<p style="margin:16px 0 0 0">' +
      '<a href="' +
      link +
      '" class="btn" style="display:inline-block;background:' +
      light_btn_bg +
      ';color:' +
      light_btn_text +
      ';font-weight:700;padding:12px 16px;border-radius:999px;text-decoration:none">View auction</a>' +
      '</p>';
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en" style="margin:0;padding:0">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <title>${subject}</title>
      <style>
        a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
        .bg-page{background:${light_bg}}
        .card{background:${light_card};border:1px solid ${light_border}}
        .text{color:${light_text}}
        .muted{opacity:.9}
        .link{color:${light_link};text-decoration:underline}
        .stripe{background:${light_stripe}}
        .btn{background:${light_btn_bg};color:${light_btn_text};font-weight:700;padding:12px 16px;border-radius:999px;text-decoration:none}
        @media (prefers-color-scheme: dark){
          .bg-page{background:${dark_bg}!important}
          .card{background:${dark_card}!important;border-color:${dark_border}!important}
          .text{color:${dark_text}!important}
          .link{color:${dark_link}!important}
          .stripe{background:${dark_stripe}!important}
          .btn{background:${dark_btn_bg}!important;color:${dark_btn_text}!important}
        }
        [data-ogsc] .bg-page{background:${dark_bg}!important}
        [data-ogsc] .card{background:${dark_card}!important;border-color:${dark_border}!important}
        [data-ogsc] .text{color:${dark_text}!important}
        [data-ogsc] .link{color:${dark_link}!important}
        [data-ogsc] .stripe{background:${dark_stripe}!important}
        [data-ogsc] .btn{background:${dark_btn_bg}!important;color:${dark_btn_text}!important}
      </style>
    </head>
    <body class="bg-page" style="margin:0;padding:0;background:${light_bg};color:${light_text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;color:transparent">${lead}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px">
              <tr>
                <td style="padding:0 8px">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="border-radius:16px;overflow:hidden">
                    <tr>
                      <td class="stripe" style="padding:14px 20px">
                        <table role="presentation" width="100%">
                          <tr>
                            <td style="font-size:18px;font-weight:700;color:${light_text};letter-spacing:.3px">${brand}</td>
                            <td align="right" style="font-size:12px;color:${light_text};opacity:.85">${kind.replace('bid_','').toUpperCase()}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="text" style="padding:28px 24px 16px 24px">
                        <h2 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;font-weight:700">${subject}</h2>
                        <p class="muted" style="margin:0 0 16px 0;font-size:16px;line-height:1.6">${lead}</p>
                        <div style="margin:0 0 4px 0">${ctx.auctionTitle} — <strong>${amount}</strong></div>
                        ${cta}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 24px 0 24px">
                        <hr style="border:none;height:1px;background:${light_border};opacity:.9" />
                      </td>
                    </tr>
                    <tr>
                      <td class="text" style="padding:14px 24px 24px 24px">
                        <p style="margin:0;font-size:12px;line-height:1.6;opacity:.85">Notification sent from ${brandLink}.</p>
                        <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;opacity:.6">© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  const ok = await deliver(ctx.to, fromHeader, subject, html);
  if (!ok) logWarn('email.send_failed', { kind, to: ctx.to.email, subject });
}

