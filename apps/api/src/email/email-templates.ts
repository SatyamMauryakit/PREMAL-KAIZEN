/**
 * Premium HTML email template system for PREMAL KAIZEN.
 *
 * All emails use table-based layouts with fully inline CSS for maximum
 * compatibility across Gmail, Outlook, Apple Mail and mobile clients.
 * No JavaScript, no web-font @import, no unsupported CSS properties.
 *
 * Color palette (matches the storefront):
 *   Black:    #000000  — primary text, hero bar
 *   Cream:    #F5F1ED  — background, light surfaces
 *   Beige:    #D4C5B9  — accent, buttons
 *   Gray:     #666666  — secondary text
 *   White:    #FFFFFF  — card backgrounds
 *   Green:    #16a34a  — success
 *   Red:      #dc2626  — error / danger
 *   Yellow:   #d97706  — warning / pending
 */

// ---------------------------------------------------------------------------
// Shared layout constants
// ---------------------------------------------------------------------------
const BRAND_NAME = 'PREMAL KAIZEN';
const BRAND_TAGLINE = 'Wear Your Vibe. Own Your Story.';
const BRAND_COLOR = '#000000';
const CREAM = '#F5F1ED';
const BEIGE = '#D4C5B9';
const GRAY = '#666666';

// ---------------------------------------------------------------------------
// Helper: escape HTML special chars in user-supplied strings
// ---------------------------------------------------------------------------
export function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// ---------------------------------------------------------------------------
// Helper: format paise → ₹ (Indian grouping, no decimals)
// ---------------------------------------------------------------------------
export function fmtPaise(paise: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// CTA button
// ---------------------------------------------------------------------------
export function ctaButton(label: string, url: string, color = BRAND_COLOR): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
      <tr>
        <td align="center" style="background-color:${color};border-radius:6px;">
          <a href="${esc(url)}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

// ---------------------------------------------------------------------------
// Branded header bar
// ---------------------------------------------------------------------------
function header(): string {
  return `
    <tr>
      <td align="center" style="background-color:${BRAND_COLOR};padding:32px 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center">
              <h1 style="margin:0;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:3px;color:#ffffff;text-transform:uppercase;">${BRAND_NAME}</h1>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#999999;letter-spacing:2px;text-transform:uppercase;">${BRAND_TAGLINE}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Footer bar
// ---------------------------------------------------------------------------
function footer(storefrontUrl: string, instagram?: string): string {
  const igLine = instagram
    ? `<a href="${esc(instagram)}" style="color:#aaaaaa;text-decoration:none;" target="_blank">Instagram</a> &nbsp;·&nbsp; `
    : '';
  return `
    <tr>
      <td align="center" style="background-color:#111111;padding:28px 40px;">
        <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:11px;color:#666666;letter-spacing:2px;text-transform:uppercase;">${BRAND_NAME}</p>
        <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:11px;color:#555555;">
          ${igLine}<a href="${storefrontUrl}" style="color:#aaaaaa;text-decoration:none;" target="_blank">Visit Store</a>
          &nbsp;·&nbsp; <a href="${storefrontUrl}/contact" style="color:#aaaaaa;text-decoration:none;" target="_blank">Contact</a>
          &nbsp;·&nbsp; <a href="${storefrontUrl}/orders" style="color:#aaaaaa;text-decoration:none;" target="_blank">Track Order</a>
        </p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#444444;">
          © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br>
          This is an automated email — please do not reply directly.
        </p>
      </td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Outer wrapper — wraps any content section(s) in the full email shell
// ---------------------------------------------------------------------------
export function emailShell(
  contentRows: string,
  storefrontUrl: string,
  instagram?: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${BRAND_NAME}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${CREAM};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          ${header()}
          ${contentRows}
          ${footer(storefrontUrl, instagram)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Section helper: white card content area
// ---------------------------------------------------------------------------
export function section(html: string): string {
  return `
    <tr>
      <td style="padding:36px 40px;background-color:#ffffff;font-family:Arial,sans-serif;font-size:15px;color:#333333;line-height:1.6;">
        ${html}
      </td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------
export function divider(): string {
  return `<tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #eeeeee;margin:0;"/></td></tr>`;
}

// ---------------------------------------------------------------------------
// Greeting line
// ---------------------------------------------------------------------------
export function greeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:17px;font-weight:bold;color:#000000;">Hi ${esc(name)},</p>`;
}

// ---------------------------------------------------------------------------
// Hero text row (big headline inside the card)
// ---------------------------------------------------------------------------
export function heroText(line1: string, icon = ''): string {
  return `<p style="margin:0 0 24px;font-size:24px;font-weight:bold;color:#000000;line-height:1.3;">${icon ? `${icon} ` : ''}${esc(line1)}</p>`;
}

// ---------------------------------------------------------------------------
// Info box (coloured banner)
// ---------------------------------------------------------------------------
export function infoBox(html: string, color: 'green' | 'red' | 'yellow' | 'blue' | 'neutral' = 'neutral'): string {
  const bg: Record<string, string> = { green: '#f0fdf4', red: '#fef2f2', yellow: '#fffbeb', blue: '#eff6ff', neutral: CREAM };
  const border: Record<string, string> = { green: '#bbf7d0', red: '#fecaca', yellow: '#fde68a', blue: '#bfdbfe', neutral: BEIGE };
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
    <tr><td style="padding:14px 18px;background-color:${bg[color]};border:1px solid ${border[color]};border-radius:6px;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.5;">
      ${html}
    </td></tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// OTP display box
// ---------------------------------------------------------------------------
export function otpBox(otp: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr>
        <td align="center" style="padding:24px;background-color:${CREAM};border:2px dashed ${BEIGE};border-radius:8px;">
          <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:${GRAY};letter-spacing:2px;text-transform:uppercase;">Your Verification Code</p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:40px;font-weight:bold;letter-spacing:12px;color:#000000;">${esc(otp)}</p>
        </td>
      </tr>
    </table>`;
}

// ---------------------------------------------------------------------------
// Order items table
// ---------------------------------------------------------------------------
export interface TemplateOrderItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number; // paise
  selectedSize?: string | null;
  selectedColor?: string | null;
}

export function orderItemsTable(items: TemplateOrderItem[]): string {
  if (!items || items.length === 0) return '';
  const rows = items.map((i) => {
    const variant = [i.selectedSize, i.selectedColor].filter(Boolean).join(' / ');
    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-family:Arial,sans-serif;font-size:14px;color:#333333;">
        <strong>${esc(i.name)}</strong>${variant ? `<br><span style="font-size:12px;color:${GRAY};">${esc(variant)}</span>` : ''}
        ${i.sku ? `<br><span style="font-size:11px;color:#aaaaaa;">SKU: ${esc(i.sku)}</span>` : ''}
      </td>
      <td align="center" style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-family:Arial,sans-serif;font-size:14px;color:${GRAY};">×${i.quantity}</td>
      <td align="right" style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-family:Arial,sans-serif;font-size:14px;color:#000000;font-weight:bold;">${fmtPaise(i.unitPrice * i.quantity)}</td>
    </tr>`;
  }).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1px solid #eeeeee;border-radius:6px;overflow:hidden;">
    <thead>
      <tr style="background-color:#f9f9f9;">
        <th style="padding:10px 8px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:${GRAY};text-align:left;letter-spacing:1px;text-transform:uppercase;">Item</th>
        <th style="padding:10px 8px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:${GRAY};text-align:center;letter-spacing:1px;text-transform:uppercase;">Qty</th>
        <th style="padding:10px 8px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:${GRAY};text-align:right;letter-spacing:1px;text-transform:uppercase;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ---------------------------------------------------------------------------
// Order totals summary
// ---------------------------------------------------------------------------
export interface TemplateTotals {
  subtotal?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  total?: number;
}

export function orderTotalsTable(t: TemplateTotals): string {
  const rows: string[] = [];
  if (t.subtotal != null) rows.push(totalsRow('Subtotal', fmtPaise(t.subtotal)));
  if (t.discount && t.discount > 0) rows.push(totalsRow('Discount', `−&thinsp;${fmtPaise(t.discount)}`, '#16a34a'));
  if (t.shipping != null) rows.push(totalsRow('Shipping', t.shipping === 0 ? '<span style="color:#16a34a;">FREE</span>' : fmtPaise(t.shipping)));
  if (t.tax != null && t.tax > 0) rows.push(totalsRow('GST', fmtPaise(t.tax)));
  if (t.total != null) {
    rows.push(`<tr>
      <td style="padding:12px 8px 4px;border-top:2px solid #000000;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#000000;">Total</td>
      <td align="right" style="padding:12px 8px 4px;border-top:2px solid #000000;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#000000;">${fmtPaise(t.total)}</td>
    </tr>`);
  }
  if (rows.length === 0) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;">
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function totalsRow(label: string, value: string, color = '#333333'): string {
  return `<tr>
    <td style="padding:6px 8px;font-family:Arial,sans-serif;font-size:14px;color:${GRAY};">${label}</td>
    <td align="right" style="padding:6px 8px;font-family:Arial,sans-serif;font-size:14px;color:${color};">${value}</td>
  </tr>`;
}

// ---------------------------------------------------------------------------
// Shipping address block
// ---------------------------------------------------------------------------
export interface TemplateAddress {
  firstName: string;
  lastName: string;
  street1: string;
  street2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phoneNumber: string;
}

export function addressBlock(a: TemplateAddress): string {
  const lines = [
    `<strong>${esc(a.firstName)} ${esc(a.lastName)}</strong>`,
    esc(a.street1),
    a.street2 ? esc(a.street2) : null,
    a.landmark ? `Near ${esc(a.landmark)}` : null,
    `${esc(a.city)}, ${esc(a.state)} — ${esc(a.postalCode)}`,
    esc(a.country),
    `📞 ${esc(a.phoneNumber)}`,
  ].filter(Boolean).join('<br>');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0;">
    <tr><td style="padding:14px 18px;background-color:${CREAM};border-left:3px solid ${BRAND_COLOR};border-radius:0 6px 6px 0;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.6;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:bold;color:${GRAY};letter-spacing:1.5px;text-transform:uppercase;">Shipping Address</p>
      ${lines}
    </td></tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
export function statusBadge(status: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    pending:          { bg: '#fef9c3', text: '#854d0e' },
    confirmed:        { bg: '#dbeafe', text: '#1e40af' },
    processing:       { bg: '#dbeafe', text: '#1e40af' },
    packed:           { bg: '#dbeafe', text: '#1e40af' },
    shipped:          { bg: '#ede9fe', text: '#5b21b6' },
    out_for_delivery: { bg: '#ede9fe', text: '#5b21b6' },
    delivered:        { bg: '#dcfce7', text: '#166534' },
    cancelled:        { bg: '#fee2e2', text: '#991b1b' },
    completed:        { bg: '#dcfce7', text: '#166534' },
    failed:           { bg: '#fee2e2', text: '#991b1b' },
    refunded:         { bg: '#e0f2fe', text: '#075985' },
  };
  const c = colors[status.toLowerCase()] ?? { bg: CREAM, text: '#333333' };
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  return `<span style="display:inline-block;padding:4px 12px;background-color:${c.bg};color:${c.text};font-family:Arial,sans-serif;font-size:13px;font-weight:bold;border-radius:20px;">${esc(label)}</span>`;
}

// ---------------------------------------------------------------------------
// Key-value info row (e.g. "Order ID: PK-2026-000001")
// ---------------------------------------------------------------------------
export function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:${GRAY};white-space:nowrap;">${esc(label)}</td>
    <td style="padding:5px 0 5px 16px;font-family:Arial,sans-serif;font-size:14px;color:#000000;font-weight:bold;">${value}</td>
  </tr>`;
}

export function infoTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;">${rows}</table>`;
}
