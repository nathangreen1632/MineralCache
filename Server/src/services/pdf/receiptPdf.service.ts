// Server/src/services/pdf/receiptPdf.service.ts
import PDFDocument from 'pdfkit';

export type ReceiptItem = {
  title: string;
  vendorName?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku?: string | null;
};

export type ReceiptData = {
  orderId: number;
  createdAt: Date;
  buyerEmail?: string | null;
  buyerName?: string | null;
  billingAddress?: string | null;   // render-ready single-line or multi-line string
  shippingAddress?: string | null;  // same as above
  items: ReceiptItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

function centsToUsd(cents: number): string {
  const v = Number.isFinite(cents) ? cents : 0;
  return `$${(v / 100).toFixed(2)}`;
}

function writeKeyValue(doc: PDFKit.PDFDocument, key: string, value?: string | null): void {
  if (!value) return;
  doc.font('Helvetica-Bold').text(key, { continued: true });
  doc.font('Helvetica').text(` ${value}`);
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.font('Helvetica-Bold').fontSize(18).text('Mineral Cache — Order Receipt');
    doc.moveDown(0.25);
    doc.fontSize(11);
    writeKeyValue(doc, 'Order #', String(data.orderId));
    writeKeyValue(doc, 'Date:', new Date(data.createdAt).toLocaleString());
    writeKeyValue(doc, 'Buyer:', data.buyerName ? `${data.buyerName} <${data.buyerEmail ?? ''}>` : (data.buyerEmail ?? undefined));
    doc.moveDown(0.5);

    // Addresses block
    const yStart = doc.y;
    if (data.billingAddress) {
      doc.font('Helvetica-Bold').text('Billing Address');
      doc.font('Helvetica').text(data.billingAddress);
    }
    const col2X = 300;
    if (data.shippingAddress) {
      doc.y = yStart;
      doc.x = col2X;
      doc.font('Helvetica-Bold').text('Shipping Address');
      doc.font('Helvetica').text(data.shippingAddress);
      doc.x = 50;
    }
    doc.moveDown(0.75);

    // Items table header
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold');
    const col = { title: 50, vendor: 260, qty: 380, unit: 430, total: 500 };
    doc.text('Item', col.title, doc.y);
    doc.text('Vendor', col.vendor, doc.y);
    doc.text('Qty', col.qty, doc.y, { width: 30, align: 'right' });
    doc.text('Unit', col.unit, doc.y, { width: 60, align: 'right' });
    doc.text('Line Total', col.total, doc.y, { width: 80, align: 'right' });
    doc.moveTo(50, doc.y + 3).lineTo(560, doc.y + 3).stroke();
    doc.moveDown(0.25);

    // Items rows
    doc.font('Helvetica');
    data.items.forEach((it) => {
      const y = doc.y;
      const titleLines: string[] = [];
      titleLines.push(it.title);
      if (it.sku) titleLines.push(`SKU: ${it.sku}`);

      doc.text(titleLines.join(' • '), col.title, y, { width: 190 });
      doc.text(it.vendorName ?? '', col.vendor, y, { width: 100 });
      doc.text(String(it.quantity), col.qty, y, { width: 30, align: 'right' });
      doc.text(centsToUsd(it.unitPriceCents), col.unit, y, { width: 60, align: 'right' });
      doc.text(centsToUsd(it.lineTotalCents), col.total, y, { width: 80, align: 'right' });
      doc.moveDown(0.2);
    });

    // Totals
    doc.moveDown(0.4);
    doc.moveTo(360, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.2);
    const rightKey = (k: string, v: string) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').text(k, 360, y, { width: 100, align: 'right' });
      doc.font('Helvetica').text(v, 470, y, { width: 90, align: 'right' });
      doc.moveDown(0.1);
    };
    rightKey('Subtotal:', centsToUsd(data.subtotalCents));
    rightKey('Shipping & Handling:', centsToUsd(data.shippingCents));
    rightKey('Tax:', centsToUsd(data.taxCents));
    doc.moveDown(0.1);
    doc.moveTo(360, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.1);
    doc.font('Helvetica-Bold');
    const y = doc.y;
    doc.text('Total:', 360, y, { width: 100, align: 'right' });
    doc.text(centsToUsd(data.totalCents), 470, y, { width: 90, align: 'right' });

    // Footer
    doc.moveDown(1.2);
    doc.font('Helvetica-Oblique').fontSize(10).text('Thank you for your purchase from Mineral Cache.', { align: 'center' });
    doc.end();
  });
}
