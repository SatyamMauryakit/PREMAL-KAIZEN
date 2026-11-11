/**
 * Premium single-page GST Tax Invoice — Amazon/Flipkart style.
 *
 * Design rules:
 *  • One page for typical orders (2–4 items). Auto page-break only when content
 *    genuinely overflows — no double-drawing, no phantom blank pages.
 *  • Clean white background, thin ruled borders — no heavy black header overlay.
 *  • Compact rows with product thumbnail (JPEG/PNG; WebP falls back to a grey box).
 *  • All amounts from the persisted order snapshot (paise → rupees at render time).
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as PDFKit from 'pdfkit';
import { InvoiceRenderData, InvoiceLineItem } from './invoices.service';

// ── Colour palette ─────────────────────────────────────────────────────────
const BLACK = '#000000';
const DKGRAY = '#222222';
const MDGRAY = '#555555';
const LTGRAY = '#888888';
const BGLINE = '#DDDDDD';   // table / rule lines
const BGALT = '#F7F7F7';   // alternating row tint
const ACCENT = '#1a6bac';   // blue accent – invoice number, totals header (Amazon-ish)
const GREEN = '#197d3e';   // paid / free shipping
const AMBER = '#b45309';   // COD pending

// ── Page geometry ──────────────────────────────────────────────────────────
const PW = 595.28;          // A4 width  (pt)
const PH = 841.89;          // A4 height (pt)
const ML = 36;              // left margin
const MR = 36;              // right margin
const MT = 32;              // top margin
const MB = 36;              // bottom margin
const CW = PW - ML - MR;   // content width  (= 523 pt)

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip control chars from user input before passing to pdfkit. */
function clean(v: string | null | undefined): string {
  if (!v) return '';
  // eslint-disable-next-line no-control-regex -- intentional: stripping control chars is the point
  return String(v).replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Paise → "₹1,700" */
function fmt(paise: number): string {
  return `₹${(Math.round(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Resolve logo: look for wordmark PNG relative to process.cwd() (= apps/api). */
function logoPath(): string | null {
  const tries = [
    path.resolve(process.cwd(), '../../apps/storefront/public/logo/logo-wordmark-black.png'),
    path.resolve(process.cwd(), '../storefront/public/logo/logo-wordmark-black.png'),
    path.resolve(process.cwd(), '../../apps/storefront/public/logo/logo-icon-black.png'),
    path.resolve(process.cwd(), '../storefront/public/logo/logo-icon-black.png'),
  ];
  return tries.find(p => fs.existsSync(p)) ?? null;
}

/** Resolve a product image URL → local file (JPEG/PNG only; WebP → null). */
function resolveImg(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const fname = path.basename(new URL(url).pathname);
    if (/\.webp$/i.test(fname)) return null;
    const p = path.resolve(process.cwd(), 'uploads', fname);
    return fs.existsSync(p) ? p : null;
  } catch { return null; }
}

// ── Service ────────────────────────────────────────────────────────────────
@Injectable()
export class InvoicePdfService {
  private readonly log = new Logger(InvoicePdfService.name);

  async render(data: InvoiceRenderData): Promise<Buffer> {
    const doc: PDFKit.PDFDocument = new (PDFKit as any).default({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      info: { Title: `Invoice ${data.invoiceNumber}`, Author: data.business.storeName },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>(res => doc.on('end', () => res(Buffer.concat(chunks))));

    try {
      this.drawInvoice(doc, data);
    } catch (err) {
      this.log.error(`PDF failed [${data.invoiceNumber}]: ${(err as Error).message}`);
      throw err;
    }
    doc.end();
    return done;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Main layout
  // ═══════════════════════════════════════════════════════════════════════
  private drawInvoice(doc: PDFKit.PDFDocument, d: InvoiceRenderData): void {
    let y = MT;
    y = this.header(doc, d, y);
    y = this.metaRow(doc, d, y);
    y = this.addresses(doc, d, y);
    y = this.itemsTable(doc, d, y);
    y = this.totalsBlock(doc, d, y);
    y = this.paymentBlock(doc, d, y);
    this.footer(doc, d);
    this.pageNumbers(doc);
  }

  // ── 1. Header ──────────────────────────────────────────────────────────
  private header(doc: PDFKit.PDFDocument, d: InvoiceRenderData, y: number): number {
    const H = 64;                        // header height

    // Thin top accent bar (blue, 3 pt)
    doc.rect(0, 0, PW, 3).fill(ACCENT);

    // "TAX INVOICE" label — right-aligned, large, accent colour
    doc.fontSize(20).font('Helvetica-Bold').fillColor(ACCENT);
    doc.text('TAX INVOICE', ML, y + 6, { width: CW, align: 'right' });

    // ── Logo / brand name ──
    const logoFile = logoPath();
    if (logoFile) {
      try {
        doc.image(logoFile, ML, y + 4, { height: 36 });
      } catch {
        this.textBrand(doc, ML, y);
      }
    } else {
      this.textBrand(doc, ML, y);
    }

    // ── Company details (below logo, left) ──
    let cy = y + 44;
    doc.fontSize(7.5).font('Helvetica').fillColor(LTGRAY);
    const biz: string[] = [];
    if (d.business.storeEmail) biz.push(d.business.storeEmail);
    if (d.business.storePhone && d.business.storePhone !== '+91-XXX-XXX-XXXX')
      biz.push(d.business.storePhone);
    if (d.business.businessAddress) biz.push(clean(d.business.businessAddress));
    if (d.business.gstin) biz.push(`GSTIN: ${d.business.gstin}`);

    if (biz.length) {
      doc.text(biz.join('  |  '), ML, cy, { width: CW, lineBreak: false });
      cy += 11;
    }

    // Bottom rule
    const ruleY = cy + 4;
    doc.moveTo(ML, ruleY).lineTo(ML + CW, ruleY).lineWidth(0.5).strokeColor(BGLINE).stroke();
    return ruleY + 8;
  }

  private textBrand(doc: PDFKit.PDFDocument, x: number, y: number) {
    doc.fontSize(18).font('Helvetica-Bold').fillColor(BLACK);
    doc.text('PREMAL KAIZEN', x, y + 8, { width: 220, lineBreak: false });
  }

  // ── 2. Invoice meta row ────────────────────────────────────────────────
  private metaRow(doc: PDFKit.PDFDocument, d: InvoiceRenderData, y: number): number {
    const fields = [
      { label: 'Invoice No.', value: d.invoiceNumber },
      { label: 'Invoice Date', value: fmtDate(d.invoiceDate) },
      { label: 'Order No.', value: d.orderNumber },
      { label: 'Order Date', value: fmtDate(d.placedAt) },
    ];
    const colW = CW / fields.length;
    const H = 26;

    // Background
    doc.rect(ML, y, CW, H).fill('#EEF4FC');

    fields.forEach((f, i) => {
      const x = ML + i * colW;
      doc.fontSize(6.5).font('Helvetica').fillColor(MDGRAY);
      doc.text(f.label, x + 6, y + 5, { width: colW - 8, lineBreak: false });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(i === 0 ? ACCENT : DKGRAY);
      doc.text(clean(f.value), x + 6, y + 14, { width: colW - 8, lineBreak: false });
      if (i > 0) {
        doc.moveTo(x, y + 4).lineTo(x, y + H - 4).lineWidth(0.4).strokeColor(BGLINE).stroke();
      }
    });

    doc.rect(ML, y, CW, H).lineWidth(0.5).strokeColor(BGLINE).stroke();
    return y + H + 10;
  }

  // ── 3. Bill To / Ship To ───────────────────────────────────────────────
  private addresses(doc: PDFKit.PDFDocument, d: InvoiceRenderData, y: number): number {
    const colW = (CW - 8) / 2;
    const rightX = ML + colW + 8;
    const PAD = 8;

    // Measure content heights first — NO drawing yet
    const billLines = this.billLines(d);
    const shipLines = this.shipLines(d);

    doc.fontSize(8).font('Helvetica');
    const billH = billLines.reduce((h, l) => h + doc.heightOfString(l, { width: colW - PAD * 2 }) + 2, 0);
    const shipH = shipLines.reduce((h, l) => h + doc.heightOfString(l, { width: colW - PAD * 2 }) + 2, 0);
    const boxH = Math.max(billH, shipH) + PAD * 2 + 16; // 16 for section label row

    // Draw once
    const labelH = 16;
    // Left label
    doc.rect(ML, y, colW, labelH).fill(DKGRAY);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('BILL TO', ML + PAD, y + 5, { width: colW - PAD * 2, lineBreak: false });
    // Right label
    doc.rect(rightX, y, colW, labelH).fill(DKGRAY);
    doc.text('SHIP TO', rightX + PAD, y + 5, { width: colW - PAD * 2, lineBreak: false });

    const contentH = boxH - labelH;
    // Content backgrounds
    doc.rect(ML, y + labelH, colW, contentH).fill('#FFFFFF').stroke();
    doc.rect(rightX, y + labelH, colW, contentH).fill('#FFFFFF').stroke();
    doc.rect(ML, y + labelH, colW, contentH).lineWidth(0.4).strokeColor(BGLINE).stroke();
    doc.rect(rightX, y + labelH, colW, contentH).lineWidth(0.4).strokeColor(BGLINE).stroke();

    // Bill lines
    let by = y + labelH + PAD;
    for (const line of billLines) {
      const isBold = line === billLines[0];
      doc.fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(isBold ? DKGRAY : MDGRAY);
      doc.text(clean(line), ML + PAD, by, { width: colW - PAD * 2, lineBreak: false });
      by += doc.heightOfString(clean(line), { width: colW - PAD * 2 }) + 2;
    }

    // Ship lines
    let sy = y + labelH + PAD;
    for (const line of shipLines) {
      const isBold = line === shipLines[0];
      doc.fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(isBold ? DKGRAY : MDGRAY);
      doc.text(clean(line), rightX + PAD, sy, { width: colW - PAD * 2, lineBreak: false });
      sy += doc.heightOfString(clean(line), { width: colW - PAD * 2 }) + 2;
    }

    return y + boxH + 12;
  }

  private billLines(d: InvoiceRenderData): string[] {
    const lines: string[] = [d.customer.name || 'Customer'];
    if (d.customer.email) lines.push(d.customer.email);
    if (d.customer.phone) lines.push(`Ph: ${d.customer.phone}`);
    return lines.filter(Boolean);
  }

  private shipLines(d: InvoiceRenderData): string[] {
    const s = d.shippingAddress;
    if (!s) return ['No shipping address'];
    const lines: string[] = [`${s.firstName} ${s.lastName}`.trim()];
    lines.push(s.street1);
    if (s.street2) lines.push(s.street2);
    if (s.landmark) lines.push(`Near ${s.landmark}`);
    lines.push(`${s.city}, ${s.state} – ${s.postalCode}`);
    lines.push(s.country);
    lines.push(`Ph: ${s.phoneNumber}`);
    return lines.filter(Boolean);
  }

  // ── 4. Items table ─────────────────────────────────────────────────────
  // Columns: [IMG 36] [ITEM description ~200] [SKU/Size 80] [QTY 30] [UNIT 72] [AMOUNT 72]
  private readonly C = {
    img: { x: ML, w: 36 },
    item: { x: ML + 36, w: 196 },
    sku: { x: ML + 232, w: 80 },
    qty: { x: ML + 312, w: 34 },
    unit: { x: ML + 346, w: 82 },
    amount: { x: ML + 428, w: CW - 428 + ML - ML }, // fills to right margin
  } as const;

  private tableHeader(doc: PDFKit.PDFDocument, y: number): number {
    const H = 18;
    doc.rect(ML, y, CW, H).fill(DKGRAY);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
    const c = this.C;
    const ty = y + 6;
    doc.text('IMG', c.img.x + 2, ty, { width: c.img.w - 2, lineBreak: false });
    doc.text('DESCRIPTION', c.item.x + 4, ty, { width: c.item.w - 4, lineBreak: false });
    doc.text('SKU / SIZE', c.sku.x + 2, ty, { width: c.sku.w - 4, lineBreak: false });
    doc.text('QTY', c.qty.x, ty, { width: c.qty.w, align: 'center', lineBreak: false });
    doc.text('UNIT PRICE', c.unit.x, ty, { width: c.unit.w, align: 'right', lineBreak: false });
    doc.text('AMOUNT', c.amount.x, ty, { width: c.amount.w - 2, align: 'right', lineBreak: false });
    return y + H;
  }

  private itemsTable(doc: PDFKit.PDFDocument, d: InvoiceRenderData, startY: number): number {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(DKGRAY);
    doc.text('ITEMS', ML, startY, { lineBreak: false });
    let y = startY + 12;
    y = this.tableHeader(doc, y);

    const c = this.C;

    d.items.forEach((item, idx) => {
      // Measure row height before drawing
      const variant = [item.selectedSize, item.selectedColor].filter(Boolean).join(' / ');
      const nameText = clean(item.name) + (variant ? `\n${variant}` : '');
      doc.font('Helvetica-Bold').fontSize(8);
      const nameH = doc.heightOfString(nameText, { width: c.item.w - 8 });
      const ROW_H = Math.max(nameH + 10, 42); // at least 42pt (room for 36pt thumbnail)

      // Page-break guard
      if (y + ROW_H > PH - MB - 130) {
        doc.addPage();
        y = MT;
        y = this.tableHeader(doc, y);
      }

      // Row background
      if (idx % 2 === 1) doc.rect(ML, y, CW, ROW_H).fill(BGALT);
      else doc.rect(ML, y, CW, ROW_H).fill('#FFFFFF');

      // Bottom divider
      doc.moveTo(ML, y + ROW_H).lineTo(ML + CW, y + ROW_H)
        .lineWidth(0.3).strokeColor(BGLINE).stroke();

      const midY = y + (ROW_H - 36) / 2;

      // ── Product thumbnail ──────────────────────────────
      const imgPath = resolveImg(item.imageUrl);
      if (imgPath) {
        try {
          doc.image(imgPath, c.img.x + 1, midY, { width: 34, height: 34 });
        } catch {
          this.imgPlaceholder(doc, c.img.x + 1, midY, 34);
        }
      } else {
        this.imgPlaceholder(doc, c.img.x + 1, midY, 34);
      }

      // ── Item name + variant ────────────────────────────
      const textY = y + 7;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(DKGRAY);
      doc.text(clean(item.name), c.item.x + 4, textY, { width: c.item.w - 8, lineBreak: false });
      if (variant) {
        doc.fontSize(7.5).font('Helvetica').fillColor(LTGRAY);
        doc.text(variant, c.item.x + 4, textY + 12, { width: c.item.w - 8, lineBreak: false });
      }

      // ── SKU ────────────────────────────────────────────
      doc.fontSize(7.5).font('Helvetica').fillColor(MDGRAY);
      doc.text(clean(item.sku) || '—', c.sku.x + 2, textY, { width: c.sku.w - 4, lineBreak: false });

      // ── Qty ────────────────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').fillColor(DKGRAY);
      doc.text(String(item.quantity), c.qty.x, textY, { width: c.qty.w, align: 'center', lineBreak: false });

      // ── Unit price ─────────────────────────────────────
      doc.fontSize(8.5).font('Helvetica').fillColor(DKGRAY);
      doc.text(fmt(item.unitPrice), c.unit.x, textY, { width: c.unit.w, align: 'right', lineBreak: false });

      // ── Line total (bold) ──────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').fillColor(BLACK);
      doc.text(fmt(item.lineTotal), c.amount.x, textY, { width: c.amount.w - 2, align: 'right', lineBreak: false });

      y += ROW_H;
    });

    // Table outer border
    doc.rect(ML, startY + 12, CW, y - startY - 12).lineWidth(0.5).strokeColor(BGLINE).stroke();
    return y + 10;
  }

  private imgPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
    doc.rect(x, y, size, size).fill('#EEEEEE');
    doc.fontSize(6).font('Helvetica').fillColor('#AAAAAA');
    doc.text('IMG', x, y + size / 2 - 3, { width: size, align: 'center', lineBreak: false });
  }

  // ── 5. Totals block ────────────────────────────────────────────────────
  private totalsBlock(doc: PDFKit.PDFDocument, d: InvoiceRenderData, y: number): number {
    // Page-break guard
    if (y + 160 > PH - MB - 50) { doc.addPage(); y = MT; }

    const boxW = 220;
    const boxX = ML + CW - boxW;
    const PAD = 10;

    // Build rows (only non-zero entries)
    type Row = { label: string; value: string; bold?: boolean; color?: string };
    const rows: Row[] = [];

    rows.push({ label: 'Subtotal', value: fmt(d.subtotal) });

    if (d.discount > 0) {
      const label = d.couponCode ? `Discount (${clean(d.couponCode)})` : 'Discount';
      rows.push({ label, value: `−${fmt(d.discount)}`, color: GREEN });
    }

    rows.push({
      label: 'Shipping',
      value: d.shipping === 0 ? 'FREE' : fmt(d.shipping),
      color: d.shipping === 0 ? GREEN : undefined,
    });

    if (d.tax > 0) {
      if (d.cgst > 0 && d.sgst > 0) {
        rows.push({ label: `CGST (${d.taxRate / 2}%)`, value: fmt(d.cgst) });
        rows.push({ label: `SGST (${d.taxRate / 2}%)`, value: fmt(d.sgst) });
      } else if (d.igst > 0) {
        rows.push({ label: `IGST (${d.taxRate}%)`, value: fmt(d.igst) });
      } else {
        rows.push({ label: `GST (${d.taxRate}%)`, value: fmt(d.tax) });
      }
    }

    const ROW_H = 16;
    const boxH = rows.length * ROW_H + PAD * 2;

    // White summary box
    doc.rect(boxX, y, boxW, boxH).fill('#FFFFFF').lineWidth(0.5).strokeColor(BGLINE).stroke();

    let ry = y + PAD;
    for (const row of rows) {
      doc.fontSize(8).font('Helvetica').fillColor(row.color ?? MDGRAY);
      doc.text(row.label, boxX + PAD, ry, { width: boxW * 0.55, lineBreak: false });
      doc.text(row.value, boxX + PAD, ry, { width: boxW - PAD * 2, align: 'right', lineBreak: false });
      doc.moveTo(boxX + PAD, ry + ROW_H - 1)
        .lineTo(boxX + boxW - PAD, ry + ROW_H - 1)
        .lineWidth(0.2).strokeColor('#EEEEEE').stroke();
      ry += ROW_H;
    }

    const gTotalY = y + boxH + 2;
    const gTotalH = 24;

    // Grand Total bar — dark background, white text
    doc.rect(boxX, gTotalY, boxW, gTotalH).fill(DKGRAY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('GRAND TOTAL', boxX + PAD, gTotalY + 7, { width: boxW * 0.5, lineBreak: false });
    doc.text(fmt(d.total), boxX + PAD, gTotalY + 7, { width: boxW - PAD * 2, align: 'right', lineBreak: false });

    return gTotalY + gTotalH + 12;
  }

  // ── 6. Payment info ────────────────────────────────────────────────────
  private paymentBlock(doc: PDFKit.PDFDocument, d: InvoiceRenderData, y: number): number {
    if (y + 70 > PH - MB - 40) { doc.addPage(); y = MT; }

    const PAD = 8;
    const boxH = 52;

    doc.rect(ML, y, CW, boxH).fill('#F4F8FF').lineWidth(0.5).strokeColor(BGLINE).stroke();

    // Section label
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(ACCENT);
    doc.text('PAYMENT INFORMATION', ML + PAD, y + 6, { lineBreak: false });

    const isCod = d.paymentMethod === 'cod';
    const isPaid = d.paymentStatus === 'completed';
    const colW = CW / 3;

    // Row of payment fields
    const payFields = [
      {
        label: 'Payment Method',
        value: isCod ? 'Cash on Delivery (COD)' : titleCase(d.paymentMethod),
        color: DKGRAY,
      },
      {
        label: 'Payment Status',
        value: isCod ? 'PENDING (Pay on delivery)' : titleCase(d.paymentStatus),
        color: isCod ? AMBER : isPaid ? GREEN : '#cc0000',
      },
      {
        label: isCod ? 'Amount Payable (COD)' : isPaid ? 'Amount Paid' : 'Amount',
        value: fmt(d.total),
        color: DKGRAY,
      },
    ];

    if (!isCod && d.razorpayPaymentId) {
      payFields[2] = { label: 'Transaction ID', value: clean(d.razorpayPaymentId), color: MDGRAY };
    }

    payFields.forEach((f, i) => {
      const x = ML + PAD + i * colW;
      doc.fontSize(6.5).font('Helvetica').fillColor(LTGRAY);
      doc.text(f.label, x, y + 20, { width: colW - PAD, lineBreak: false });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(f.color);
      doc.text(f.value, x, y + 30, { width: colW - PAD, lineBreak: false });
    });

    return y + boxH + 10;
  }

  // ── 7. Footer ──────────────────────────────────────────────────────────
  private footer(doc: PDFKit.PDFDocument, d: InvoiceRenderData): void {
    const fy = PH - MB - 22;

    doc.moveTo(ML, fy).lineTo(ML + CW, fy).lineWidth(0.5).strokeColor(BGLINE).stroke();

    // Thank you (left)
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(ACCENT);
    doc.text('Thank you for shopping with PREMAL KAIZEN!', ML, fy + 5, {
      width: CW * 0.6, lineBreak: false,
    });

    // Disclaimer (right)
    doc.fontSize(6.5).font('Helvetica').fillColor(LTGRAY);
    doc.text('Computer-generated invoice. No signature required.', ML, fy + 5, {
      width: CW, align: 'right', lineBreak: false,
    });

    // Contact strip
    const contact: string[] = [];
    if (d.business.storeEmail) contact.push(d.business.storeEmail);
    if (d.business.gstin) contact.push(`GSTIN: ${d.business.gstin}`);
    const storeUrl = process.env.APP_BASE_URL || '';
    if (storeUrl) contact.push(storeUrl);

    if (contact.length) {
      doc.fontSize(6.5).font('Helvetica').fillColor(LTGRAY);
      doc.text(contact.join('  |  '), ML, fy + 14, { width: CW, align: 'center', lineBreak: false });
    }
  }

  // ── 8. Page numbers ────────────────────────────────────────────────────
  private pageNumbers(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(6.5).font('Helvetica').fillColor(LTGRAY);
      doc.text(
        `Page ${i + 1} of ${range.count}`,
        ML, PH - MB + 6,
        { width: CW, align: 'right', lineBreak: false },
      );
    }
  }
}
