import { Resend } from 'resend';
import { AdminSettings } from '../models/adminSettings.model.js';

type EmailKind = 'order_paid' | 'order_shipped' | 'order_delivered';

export type EmailAddress = { name?: string | null; email: string };

export type OrderEmailContext = {
  orderId: number;
  orderNumber?: string | null;
  buyer: EmailAddress;
  itemsBrief?: string;
  trackingUrl?: string | null;
  carrier?: string | null;
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
  const brand = row?.brandName || 'Mineral Cache';
  const fromEmail = row?.emailFrom || 'no-reply@mineralcache.local';
  return { brand, fromEmail };
}

function subjectFor(kind: EmailKind, brand: string, orderNumber?: string | null): string {
  if (kind === 'order_paid') return `[${brand}] Order confirmed${orderNumber ? ` #${orderNumber}` : ''}`;
  if (kind === 'order_shipped') return `[${brand}] Your order shipped${orderNumber ? ` #${orderNumber}` : ''}`;
  return `[${brand}] Order delivered${orderNumber ? ` #${orderNumber}` : ''}`;
}

function htmlFor(kind: EmailKind, brand: string, ctx: OrderEmailContext): string {
  const orderLine = ctx.orderNumber ? `Order #${ctx.orderNumber}` : `Order ID ${ctx.orderId}`;
  const list = ctx.itemsBrief || 'Your items are on the way.';
  let extra = '';

  if (kind === 'order_shipped') {
    const lines: string[] = [];
    if (ctx.carrier) lines.push(`Carrier: ${ctx.carrier}`);
    if (ctx.trackingUrl) lines.push(`Tracking: <a href="${ctx.trackingUrl}">${ctx.trackingUrl}</a>`);
    if (lines.length > 0) extra = `<p>${lines.join('<br/>')}</p>`;
  }

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>${brand}</h2>
      <p><strong>${orderLine}</strong></p>
      <p>${list}</p>
      ${extra}
      <p>Thank you for shopping with ${brand}.</p>
    </div>
  `;
}

/** Formats the RFC5322 "From" header like: "Brand Name <no-reply@domain.com>" */
function formatFromHeader(brand: string, fromEmail: string): string {
  return `${brand} <${fromEmail}>`;
}

/** Single send path (Resend) with graceful fallbacks and logging */
async function deliver(to: EmailAddress, fromHeader: string, subject: string, html: string): Promise<void> {
  if (!emailEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[email.disabled]', { to: to.email, subject });
    return;
  }

  const resend = getResend();
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn('[email.error] RESEND_API_KEY not set; email suppressed', { to: to.email, subject });
    return;
  }

  try {
    const result = await resend.emails.send({
      from: fromHeader,
      to: [to.email],
      subject,
      html,
    });

    // eslint-disable-next-line no-console
    console.log('[email.sent]', { to: to.email, subject, id: (result as any)?.id ?? null });
  } catch (err) {
    // Do not blow up order flows if email fails
    // eslint-disable-next-line no-console
    console.warn('[email.error] failed to send', { to: to.email, subject, err });
  }
}

export async function sendOrderEmail(kind: EmailKind, ctx: OrderEmailContext): Promise<void> {
  const { brand, fromEmail } = await getBranding();
  const subject = subjectFor(kind, brand, ctx.orderNumber ?? null);
  const html = htmlFor(kind, brand, ctx);
  const fromHeader = formatFromHeader(brand, fromEmail);

  await deliver(ctx.buyer, fromHeader, subject, html);
}
