/**
 * Dependency-free bill PDF generator.
 * Produces a valid PDF 1.4 document (Helvetica base-14 fonts, WinAnsi text)
 * using ONLY Node built-ins - no npm dependencies required.
 * Branding uses the approved Sri Varahi logo palette:
 *   Primary Green #22650f · Primary Red #7d1606 · Tomato Red #d22803
 *   Gold #e3af18 · Dark Gold #ca7a11
 */

const PALETTE = {
  green: [0x22 / 255, 0x65 / 255, 0x0f / 255], // #22650f
  red: [0x7d / 255, 0x16 / 255, 0x06 / 255], // #7d1606
  tomato: [0xd2 / 255, 0x28 / 255, 0x03 / 255], // #d22803
  gold: [0xe3 / 255, 0xaf / 255, 0x18 / 255], // #e3af18
  darkGold: [0xca / 255, 0x7a / 255, 0x11 / 255], // #ca7a11
  ink: [0.11, 0.11, 0.10],
  muted: [0.42, 0.45, 0.41],
  line: [0.89, 0.90, 0.88],
  white: [1, 1, 1],
  paper: [0.98, 0.99, 0.97],
};

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait, PDF points
const M = 40; // page margin

/** Escape a string for use inside a PDF literal string (WinAnsi-safe). */
function esc(s) {
  return String(s ?? '')
    .replace(/[\u20b9]/g, 'Rs.') // rupee sign is not in WinAnsi
    .replace(/[^\x20-\x7e]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

const n2 = (v) => Number(v || 0).toFixed(2);
const money = (v) => 'Rs.' + n2(v);

class Content {
  constructor() { this.ops = []; }
  raw(s) { this.ops.push(s); return this; }
  // Filled rectangle: (x, y, w, h) from BOTTOM-left, color [r,g,b] 0..1
  rect(x, y, w, h, color) {
    return this.raw(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`)
      .raw(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  // Colored text; size in points. (x, y) is the BASELINE of the text.
  text(x, y, str, { size = 10, color = PALETTE.ink, bold = false } = {}) {
    return this.raw('BT')
      .raw(`/${bold ? 'F2' : 'F1'} ${size} Tf`)
      .raw(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`)
      .raw(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`)
      .raw(`(${esc(str)}) Tj`)
      .raw('ET');
  }
  line(x1, y1, x2, y2, color = PALETTE.line, width = 0.7) {
    return this.raw(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG`)
      .raw(`${width} w`)
      .raw(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  build() { return this.ops.join('\n'); }
}

/** Draw the full bill and return a PDF file Buffer. */
function renderBillPdf(bill) {
  const c = new Content();
  const items = bill.items || [];
  const payments = bill.payments || [];

  // ---- Header band (Primary Green with a Gold accent stripe) ----
  const headH = 74;
  c.rect(M, PAGE.h - M - headH, PAGE.w - 2 * M, headH, PALETTE.green);
  c.rect(M, PAGE.h - M - headH - 5, PAGE.w - 2 * M, 5, PALETTE.gold);
  c.text(M + 16, PAGE.h - M - 30, 'SRI VARAHI', { size: 20, bold: true, color: PALETTE.white });
  c.text(M + 16, PAGE.h - M - 48, 'Agricultural Market Committee - ERP', { size: 9, color: PALETTE.white });
  c.text(M + 16, PAGE.h - M - 62, 'Tax Invoice / Sale Bill', { size: 8, color: PALETTE.gold });
  const rightCol = PAGE.w - M - 16;
  c.text(rightCol - 150, PAGE.h - M - 30, `Bill No: ${bill.bill_number}`, { size: 12, bold: true, color: PALETTE.white });
  const created = bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN') : '-';
  c.text(rightCol - 150, PAGE.h - M - 46, `Date: ${created}`, { size: 9, color: PALETTE.white });
  c.text(rightCol - 150, PAGE.h - M - 60, `Status: ${String(bill.status || '-').replace(/_/g, ' ').toUpperCase()}`,
    { size: 9, bold: true, color: PALETTE.gold });

  // ---- Bill meta ----
  let y = PAGE.h - M - headH - 5 - 34;
  c.text(M, y, 'Billed To', { size: 9, bold: true, color: PALETTE.darkGold });
  c.text(M, y - 15, bill.customer_name || '-', { size: 12, bold: true });
  if (bill.customer_phone) c.text(M, y - 29, `Phone: ${bill.customer_phone}`, { size: 9, color: PALETTE.muted });

  const metaX = PAGE.w / 2 + 20;
  c.text(metaX, y, 'Lot / Auction', { size: 9, bold: true, color: PALETTE.darkGold });
  c.text(metaX, y - 15, `Lot: ${bill.lot_number || '-'}`, { size: 10 });
  c.text(metaX, y - 29, `Auction ID: ${bill.auction_id ?? '-'}`, { size: 10 });

  y -= 52;
  c.line(M, y, PAGE.w - M, y, PALETTE.gold, 1.2);

  // ---- Items table ----
  const colQty = M + 300, colRate = M + 380, colAmt = PAGE.w - M;
  y -= 10;
  const rowH = 20;
  c.rect(M, y - rowH + 6, PAGE.w - 2 * M, rowH, PALETTE.paper);
  c.text(M + 6, y - 8, '#', { size: 9, bold: true, color: PALETTE.darkGold });
  c.text(M + 30, y - 8, 'DESCRIPTION', { size: 9, bold: true, color: PALETTE.darkGold });
  c.text(colQty, y - 8, 'QTY', { size: 9, bold: true, color: PALETTE.darkGold });
  c.text(colRate, y - 8, 'RATE', { size: 9, bold: true, color: PALETTE.darkGold });
  c.text(colAmt - 60, y - 8, 'AMOUNT', { size: 9, bold: true, color: PALETTE.darkGold });
  y -= rowH + 4;

  items.forEach((it, i) => {
    if (i % 2 === 1) c.rect(M, y - 5, PAGE.w - 2 * M, rowH, PALETTE.paper);
    c.text(M + 6, y, `${i + 1}`, { size: 9, color: PALETTE.muted });
    c.text(M + 30, y, `Auction allocation (lot ${bill.lot_number || '-'})`, { size: 9 });
    c.text(colQty, y, `${Number(it.quantity)}`, { size: 9 });
    c.text(colRate, y, n2(it.rate), { size: 9 });
    c.text(colAmt - 60, y, n2(it.amount), { size: 9 });
    y -= rowH;
    c.line(M, y + 6, PAGE.w - M, y + 6);
  });
  if (items.length === 0) {
    c.text(M + 30, y, 'No line items.', { size: 9, color: PALETTE.muted });
    y -= rowH;
  }

  // ---- Totals (right aligned block) ----
  y -= 14;
  const labelX = PAGE.w - M - 200, valueX = PAGE.w - M - 6;
  c.text(labelX, y, 'Total Amount', { size: 10, bold: true });
  c.text(valueX, y, money(bill.total_amount), { size: 10, bold: true, color: PALETTE.green });
  y -= 16;
  c.text(labelX, y, 'Paid Amount', { size: 10, color: PALETTE.muted });
  c.text(valueX, y, money(bill.paid_amount), { size: 10, color: PALETTE.muted });
  y -= 16;
  c.text(labelX, y, 'Balance Due', { size: 11, bold: true, color: PALETTE.tomato });
  c.text(valueX, y, money(bill.balance), { size: 11, bold: true, color: PALETTE.tomato });
  y -= 8;
  c.line(labelX, y, valueX, y, PALETTE.tomato, 1);

  // ---- Payments history ----
  if (payments.length) {
    y -= 26;
    c.text(M, y, 'PAYMENTS', { size: 9, bold: true, color: PALETTE.darkGold });
    y -= 15;
    payments.forEach((p) => {
      const when = p.paid_at ? new Date(p.paid_at).toLocaleString('en-IN') : '-';
      const ref = p.reference ? ` (${p.reference})` : '';
      c.text(M, y, `${when} - ${String(p.method || '-').toUpperCase()}${ref}`, { size: 9 });
      c.text(valueX, y, money(p.amount), { size: 9 });
      y -= 14;
    });
  }

  // ---- Footer ----
  c.rect(M, M + 18, PAGE.w - 2 * M, 22, PALETTE.red);
  c.text(PAGE.w / 2 - 110, M + 25, 'SRI VARAHI ERP - system generated bill', { size: 8, color: PALETTE.gold });
  c.line(M, M + 14, PAGE.w - M, M + 14, PALETTE.line);
  c.text(M, M + 2, 'This is a computer generated document.', { size: 7, color: PALETTE.muted });

  return assemblePdf(c.build());
}

/** 3-digit user-facing lot number (internal form is L-YYYYMMDD-NNN). */
const lot3 = (n) => {
  const tail = String(n || '').split('-').pop();
  return /^\d{1,3}$/.test(tail) ? tail.padStart(3, '0') : String(n || '-');
};

/** Draw a LOT document (lot card / bill sheet) and return a PDF Buffer. */
function renderLotPdf(lot) {
  const c = new Content();
  const seq = lot3(lot.lot_number);

  // ---- Header band (Primary Green with Gold stripe) ----
  const headH = 74;
  c.rect(M, PAGE.h - M - headH, PAGE.w - 2 * M, headH, PALETTE.green);
  c.rect(M, PAGE.h - M - headH - 5, PAGE.w - 2 * M, 5, PALETTE.gold);
  c.text(M + 16, PAGE.h - M - 30, 'SRI VARAHI', { size: 20, bold: true, color: PALETTE.white });
  c.text(M + 16, PAGE.h - M - 48, 'Agricultural Market Committee - ERP', { size: 9, color: PALETTE.white });
  c.text(M + 16, PAGE.h - M - 62, 'Lot Card / Bill Sheet', { size: 8, color: PALETTE.gold });
  c.text(PAGE.w - M - 150, PAGE.h - M - 34, `LOT ${seq}`, { size: 22, bold: true, color: PALETTE.gold });

  // ---- Lot summary table (label left, value right) ----
  let y = PAGE.h - M - headH - 5 - 36;
  const rows = [
    ['Lot Number', seq],
    ['Date', lot.inward_date || lot.lot_date || '-'],
    ['Supplier / Party', lot.party_name || '-'],
    ['Vehicle', lot.vehicle_number || '-'],
    ['Driver', lot.driver_name || '-'],
    ['Source', String(lot.purchase_source || '-').replace(/_/g, ' ')],
    ['Quality Grade', lot.quality || '-'],
    ['Total Boxes', String(Number(lot.total_quantity ?? 0))],
    ['Rate (per box)', lot.purchase_rate != null ? n2(lot.purchase_rate)
      : (lot.final_rate != null ? n2(lot.final_rate) : '-')],
    ['Amount', (lot.purchase_rate ?? lot.final_rate) != null
      ? money(Number(lot.purchase_rate ?? lot.final_rate) * Number(lot.total_quantity || 0)) : '-'],
  ];
  const rowH = 22;
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) c.rect(M, y - 7, PAGE.w - 2 * M, rowH, PALETTE.paper);
    c.text(M + 10, y, label, { size: 10, color: PALETTE.muted, bold: label === 'Lot Number' });
    c.text(PAGE.w - M - 10, y, String(value), { size: 10, bold: true, color: label === 'Lot Number' ? PALETTE.green : PALETTE.ink });
    y -= rowH;
  });

  // ---- Quantity summary ----
  y -= 12;
  c.text(M + 10, y, 'Pre-Auction Sold', { size: 10, color: PALETTE.muted });
  c.text(PAGE.w - M - 10, y, `${Number(lot.pre_auction_quantity || 0)} boxes`, { size: 10 });
  y -= 18;
  c.text(M + 10, y, 'Auction Allocated', { size: 10, color: PALETTE.muted });
  c.text(PAGE.w - M - 10, y, `${Number(lot.allocated_quantity || 0)} boxes`, { size: 10 });
  y -= 18;
  c.text(M + 10, y, 'REMAINING', { size: 11, bold: true, color: PALETTE.tomato });
  c.text(PAGE.w - M - 10, y, `${Number(lot.remaining_quantity || 0)} boxes`, { size: 11, bold: true, color: PALETTE.tomato });

  // ---- Footer ----
  c.rect(M, M + 18, PAGE.w - 2 * M, 22, PALETTE.red);
  c.text(PAGE.w / 2 - 110, M + 25, `SRI VARAHI ERP - Lot ${seq} - system generated`, { size: 8, color: PALETTE.gold });
  c.line(M, M + 14, PAGE.w - M, M + 14, PALETTE.line);
  c.text(M, M + 2, 'This is a computer generated document.', { size: 7, color: PALETTE.muted });

  return assemblePdf(c.build());
}

/** Wrap page content into a valid PDF file (objects + xref table) as a Buffer. */function assemblePdf(contentStream) {
  const objects = [];
  // 1: catalog, 2: pages, 3: page, 4: content, 5,6: fonts
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w.toFixed(2)} ${PAGE.h.toFixed(2)}] ` +
    `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`;
  const content = Buffer.from(contentStream, 'latin1');
  objects[4] = `<< /Length ${content.length} >>\nstream\n${contentStream}\nendstream`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(out, 'latin1');
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(out, 'latin1');
  const count = objects.length; // includes the free entry 0
  out += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

module.exports = { renderBillPdf, renderLotPdf };
