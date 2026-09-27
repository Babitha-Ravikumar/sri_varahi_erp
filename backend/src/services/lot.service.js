const { query } = require('../database/db');
const { renderLotPdf } = require('./pdf.service');

/** Full lot detail - everything linked to the lot identity, auto-displayed. */
async function lotDetail(lotId) {
  const lotR = await query(
    `SELECT l.*, l.remaining_quantity,
            v.vehicle_number, v.vehicle_name, v.driver_name, v.driver_phone,
            p.name AS party_name, i.id AS inward_id, i.purchase_source, i.purchase_rate,
            i.selling_price, i.final_rate, i.trade_margin, i.inward_date,
            c.card_code, c.printed AS card_printed
     FROM lots l
     JOIN inwards i ON i.id = l.inward_id
     LEFT JOIN vehicles v ON v.id = l.vehicle_id
     LEFT JOIN parties p ON p.id = l.party_id
     LEFT JOIN lot_cards c ON c.lot_id = l.id
     WHERE l.id = $1`,
    [lotId]
  );
  if (!lotR.rows[0]) { const e = new Error('Lot not found'); e.status = 404; throw e; }
  const lot = lotR.rows[0];

  const preR = await query(
    `SELECT ps.*, cu.name AS customer_name FROM pre_auction_sales ps
     JOIN customers cu ON cu.id = ps.customer_id WHERE ps.lot_id = $1 ORDER BY ps.id`,
    [lotId]
  );
  const allocR = await query(
    `SELECT a.*, cu.name AS customer_name FROM allocations a
     JOIN customers cu ON cu.id = a.customer_id
     WHERE a.lot_id = $1 AND a.status <> 'cancelled' ORDER BY a.id`,
    [lotId]
  );

  return {
    ...lot,
    pre_auction_sales: preR.rows,
    allocations: allocR.rows,
    total_allocated_quantity: Number(lot.allocated_quantity),
  };
}

/** Lots for selection during auction (default: today, not fully sold). */
async function listLots({ date, status, q } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  // date='all' → every date; YYYY-MM-DD → that day; none → today & forward.
  if (date === 'all') { /* no date filter */ }
  else if (date) { params.push(date); where += ` AND l.lot_date = $${params.length}`; }
  else where += ` AND l.lot_date >= current_date`;
  if (status) { params.push(status); where += ` AND l.status = $${params.length}`; }
  if (q) { params.push(`%${q.toUpperCase()}%`); where += ` AND (UPPER(l.lot_number) LIKE $${params.length} OR UPPER(COALESCE(v.vehicle_number,'')) LIKE $${params.length})`; }
  const r = await query(
    `SELECT l.id, l.lot_number, l.lot_date, l.status, l.created_at, l.total_quantity,
            l.pre_auction_quantity, l.allocated_quantity, l.remaining_quantity,
            v.vehicle_number, p.name AS party_name, l.quality
     FROM lots l
     LEFT JOIN vehicles v ON v.id = l.vehicle_id
     LEFT JOIN parties p ON p.id = l.party_id
     ${where} ORDER BY l.lot_date DESC, l.lot_number DESC LIMIT 200`,
    params
  );
  return r.rows;
}

/** Mark lot card printed (re-print allowed, history not affected). */
async function markCardPrinted(lotId) {
  const r = await query(
    `UPDATE lot_cards SET printed = true WHERE lot_id = $1 RETURNING *`, [lotId]
  );
  if (!r.rows[0]) { const e = new Error('Lot card not found'); e.status = 404; throw e; }
  return r.rows[0];
}

/** Render a lot document as a downloadable PDF (3-digit lot number shown). */
async function lotPdf(lotId) {
  const detail = await lotDetail(lotId);
  return { filename: `LOT-${String(detail.lot_number).split('-').pop().padStart(3, '0')}.pdf`, buffer: renderLotPdf(detail) };
}

module.exports = { lotDetail, listLots, markCardPrinted, lotPdf };
