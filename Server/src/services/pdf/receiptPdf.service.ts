// Server/src/services/pdf/receiptPdf.service.ts
import PDFDocument from 'pdfkit';
import { centsToUsd } from '../../utils/money.util.js';

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
  billingAddress?: string | null;
  shippingAddress?: string | null;
  shippingName?: string | null;
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostal?: string | null;
  shippingCountry?: string | null;
  items: ReceiptItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  brandName?: string | null;
  orderNumber?: string | null;
};

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

    const brand = (data.brandName && String(data.brandName)) || 'Mineral Cache';
    const ordLabel = data.orderNumber ? `#${data.orderNumber}` : `#${data.orderId}`;
    const createdAtStr = new Date(data.createdAt).toLocaleString();
    const buyerLine =
      data.buyerName && data.buyerEmail
        ? `${data.buyerName} <${data.buyerEmail}>`
        : data.buyerName || data.buyerEmail || '';

    doc.font('Helvetica-Bold').fontSize(18).text(`${brand} — Order Receipt`, { align: 'left' });
    doc.moveDown(0.4);

    doc.fontSize(11);
    writeKeyValue(doc, 'Order:', ordLabel);
    writeKeyValue(doc, 'Date:', createdAtStr);
    if (buyerLine) {
      writeKeyValue(doc, 'Buyer:', buyerLine);
    }
    doc.moveDown(0.8);

    const leftX = doc.page.margins.left;
    const rightX = 320;
    const yStart = doc.y;

    if (data.billingAddress) {
      doc.x = leftX;
      doc.font('Helvetica-Bold').fontSize(11).text('Billing Address');
      doc.font('Helvetica').fontSize(10).text(data.billingAddress, {
        width: rightX - leftX - 16,
      });
    }

    const hasStructuredShip =
      data.shippingName ||
      data.shippingAddress1 ||
      data.shippingAddress2 ||
      data.shippingCity ||
      data.shippingState ||
      data.shippingPostal ||
      data.shippingCountry;

    if (data.shippingAddress || hasStructuredShip) {
      doc.x = rightX;
      doc.y = yStart;
      doc.font('Helvetica-Bold').fontSize(11).text('Shipping Address');
      doc.font('Helvetica').fontSize(10);
      if (hasStructuredShip) {
        if (data.shippingName) doc.text(String(data.shippingName));
        if (data.shippingAddress1) doc.text(String(data.shippingAddress1));
        if (data.shippingAddress2) doc.text(String(data.shippingAddress2));
        const cityLine = [
          data.shippingCity || '',
          data.shippingState || '',
          data.shippingPostal || '',
          data.shippingCountry || '',
        ]
          .filter(Boolean)
          .join(', ');
        if (cityLine) doc.text(cityLine);
      } else if (data.shippingAddress) {
        doc.text(data.shippingAddress, { width: doc.page.width - rightX - doc.page.margins.right });
      }
    }

    doc.x = leftX;
    doc.moveDown(1);

    const col = { title: 50, vendor: 260, qty: 380, unit: 430, total: 500 };

    const drawTableHeader = () => {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').fontSize(10);
      const headerY = doc.y;
      doc.text('Item', col.title, headerY);
      doc.text('Vendor', col.vendor, headerY);
      doc.text('Qty', col.qty, headerY, { width: 30, align: 'right' });
      doc.text('Unit', col.unit, headerY, { width: 60, align: 'right' });
      doc.text('Line Total', col.total, headerY, { width: 80, align: 'right' });
      doc.moveTo(50, doc.y + 3).lineTo(560, doc.y + 3).stroke();
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(10);
    };

    const ensureSpace = (rowHeight: number) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + rowHeight + 32 > bottom) {
        doc.addPage();
        drawTableHeader();
      }
    };

    drawTableHeader();

    data.items.forEach((it) => {
      const titleLines: string[] = [it.title];
      if (it.sku) titleLines.push(`SKU: ${it.sku}`);
      const titleText = titleLines.join(' • ');
      const vendorText = it.vendorName ?? '';

      const titleHeight = doc.heightOfString(titleText, { width: 190 });
      const vendorHeight = doc.heightOfString(vendorText, { width: 100 });
      const rowHeight = Math.max(titleHeight, vendorHeight, 12) + 6;

      ensureSpace(rowHeight);

      const y = doc.y;
      doc.text(titleText, col.title, y, { width: 190 });
      doc.text(vendorText, col.vendor, y, { width: 100 });
      doc.text(String(it.quantity), col.qty, y, { width: 30, align: 'right' });
      doc.text(centsToUsd(it.unitPriceCents), col.unit, y, { width: 60, align: 'right' });
      doc.text(centsToUsd(it.lineTotalCents), col.total, y, { width: 80, align: 'right' });

      doc.y = y + rowHeight;
    });

    doc.moveDown(0.6);
    doc.moveTo(360, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.2);

    const rightKey = (k: string, v: string) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text(k, 360, y, { width: 100, align: 'right' });
      doc.font('Helvetica').fontSize(10).text(v, 470, y, { width: 90, align: 'right' });
      doc.moveDown(0.15);
    };

    rightKey('Subtotal:', centsToUsd(data.subtotalCents));
    rightKey('Shipping & Handling:', centsToUsd(data.shippingCents));
    if ((data.taxCents ?? 0) > 0) rightKey('Tax:', centsToUsd(data.taxCents));

    doc.moveDown(0.15);
    doc.moveTo(360, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica-Bold').fontSize(11);
    const totalY = doc.y;
    doc.text('Total:', 360, totalY, { width: 100, align: 'right' });
    doc.text(centsToUsd(data.totalCents), 470, totalY, { width: 90, align: 'right' });

    doc.moveDown(1.2);
    doc.font('Helvetica-Oblique')
      .fontSize(10)
      .text(`Thank you for your purchase from ${brand}.`, { align: 'center' });

    doc.end();
  });
}
