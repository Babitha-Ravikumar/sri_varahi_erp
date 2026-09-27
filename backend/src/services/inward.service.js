const { query, withTransaction } = require('../database/db');
const { nextLotNumber, addLotQuantity, findOrCreateParty, writeAudit, num } = require('./helpers');

/**
 * Inward + automatic Lot & Lot Card creation for all four purchase sources.
 * Every flow: ENTER ONCE -> lot number -> lot card -> linked data.
 */

const LOT_SELECT = `
  SELECT l.*, l.remaining_quantity,
         v.vehicle_number, v.vehicle_name AS vehicle_name,
         p.name AS party_name,
         i.purchase_source, i.purchase_rate, i.selling_price, i.final_rate, i.trade_margin,
         c.card_code
  FROM lots l
  JOIN inwards i ON i.id = l.inward_id
  LEFT JOIN vehicles v ON v.id = l.vehicle_id
  LEFT JOIN parties p ON p.id = l.party_id
  LEFT JOIN lot_cards c ON c.lot_id = l.id
`;

/**
 * Shared creation core. data fields per source:
 *  - local_farmer:   vehicle_id (from Vehicle Master), party, quality, quantity
 *  - local_trader:   party, quantity, purchase_rate
 *  - outside_trader: party, vehicle_name/vehicle_number + driver (free capture), quality, quantity
 *  - night_arrival:  party, vehicle + quality/quantity + selling_price (predetermined)
 */
async function createInward(source, data, user) {
  const quantity = num(data.quantity, { required: true, min: 0.01 });

  return withTransaction(async (client) => {
    let vehicleId = null;

    if (source === 'local_farmer') {
      if (!data.vehicle_id) { const e = new Error('vehicle_id is required (select from Vehicle Master)'); e.status = 400; throw e; }
      const v = await client.query('SELECT id FROM vehicles WHERE id = $1 AND active', [data.vehicle_id]);
      if (!v.rows[0]) { const e = new Error('Vehicle not found in Vehicle Master'); e.status = 404; throw e; }
      vehicleId = data.vehicle_id;
    }

    if (source === 'outside_trader' || source === 'night_arrival') {
      // Free vehicle/driver capture - vehicle may change daily. Stored on the
      // inward itself (no Vehicle Master requirement).
      if (!data.vehicle_number) { const e = new Error('vehicle_number is required'); e.status = 400; throw e; }
    }

    if (source === 'local_trader') {
      if (num(data.purchase_rate, { required: true, min: 0 }) === undefined) throw new Error('purchase_rate required');
    }

    if (source === 'night_arrival') {
      if (num(data.selling_price, { required: true, min: 0 }) === undefined) throw new Error('selling_price required');
    }

    const partyTypeMap = {
      local_farmer: 'farmer', local_trader: 'local_trader',
      outside_trader: 'outside_trader', night_arrival: 'outside_trader',
    };
    const party = await findOrCreateParty(client, {
      partyId: data.party_id, partyName: data.party_name, partyType: partyTypeMap[source],
    });

    // INSERT ONCE - this is the single inward entry for the arrival
    const inwardR = await client.query(
      `INSERT INTO inwards (purchase_source, vehicle_id, vehicle_number, vehicle_name,
                            driver_name, driver_phone, party_id, quality, quantity,
                            purchase_rate, selling_price, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [source, vehicleId, data.vehicle_number || null, data.vehicle_name || null,
       data.driver_name || null, data.driver_phone || null, party.id, data.quality || null,
       quantity, data.purchase_rate ?? null, data.selling_price ?? null, user?.id || null]
    );
    const inward = inwardR.rows[0];

    // AUTO-FLOW: lot number + lot card, linked to vehicle/party/quality/quantity
    const lotNumber = await nextLotNumber(client);
    const lotR = await client.query(
      `INSERT INTO lots (lot_number, inward_id, vehicle_id, party_id, quality, total_quantity)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [lotNumber, inward.id, vehicleId, party.id, data.quality || null, quantity]
    );
    const lot = lotR.rows[0];

    await client.query(
      `INSERT INTO lot_cards (lot_id, card_code) VALUES ($1, $2)`,
      [lot.id, lotNumber]
    );

    return { inward, lot };
  });
}

/** List inwards (optionally by date / source / vehicle - used by dashboard drill-down). */
async function listInwards({ date, source, vehicle } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (date) { params.push(date); where += ` AND i.inward_date = $${params.length}`; }
  else where += ` AND i.inward_date = current_date`;
  if (source) { params.push(source); where += ` AND i.purchase_source = $${params.length}`; }
  if (vehicle) {
    params.push(vehicle);
    where += ` AND COALESCE(v.vehicle_number, i.vehicle_number) = $${params.length}`;
  }
  const r = await query(
    `SELECT i.*, v.vehicle_number, p.name AS party_name, l.id AS lot_id, l.lot_number, l.remaining_quantity
     FROM inwards i
     LEFT JOIN vehicles v ON v.id = i.vehicle_id
     LEFT JOIN parties p ON p.id = i.party_id
     LEFT JOIN lots l ON l.inward_id = i.id
     ${where} ORDER BY i.created_at DESC`,
    params
  );
  return r.rows;
}

/** Consolidated inward view - derived 100% from inward data. */
async function consolidatedView({ date } = {}) {
  const d = date || null;
  const dayFilter = d ? 'i.inward_date = $1' : 'i.inward_date = current_date';
  const params = d ? [d] : [];

  const vehicleWise = await query(
    `SELECT COALESCE(v.vehicle_number, i.vehicle_number, 'No vehicle') AS vehicle_number,
            count(DISTINCT l.id) AS lot_count,
            SUM(i.quantity) AS total_boxes
     FROM inwards i
     LEFT JOIN vehicles v ON v.id = i.vehicle_id
     LEFT JOIN lots l ON l.inward_id = i.id
     WHERE ${dayFilter}
     GROUP BY 1 ORDER BY 1`,
    params
  );

  const totals = await query(
    `SELECT count(DISTINCT l.id) AS total_lots, COALESCE(SUM(i.quantity),0) AS total_boxes
     FROM inwards i
     LEFT JOIN lots l ON l.inward_id = i.id
     WHERE ${dayFilter}`,
    params
  );

  const sourceWise = await query(
    `SELECT i.purchase_source, count(*) AS inward_count, SUM(i.quantity) AS total_boxes
     FROM inwards i WHERE ${dayFilter} GROUP BY i.purchase_source`,
    params
  );

  return {
    date: d || new Date().toISOString().slice(0, 10),
    vehicle_wise: vehicleWise.rows,
    source_wise: sourceWise.rows,
    today_total_lots: Number(totals.rows[0].total_lots),
    today_total_boxes: Number(totals.rows[0].total_boxes),
  };
}

/**
 * NIGHT ARRIVAL - fix the morning final purchase rate on the SAME inward
 * (no duplicate inward). Computes trade margin from all customer sales
 * already recorded at the predetermined selling price.
 */
async function fixFinalRate(inwardId, { final_rate }, user) {
  const rate = num(final_rate, { required: true, min: 0 });
  return withTransaction(async (client) => {
    const inwardR = await client.query(
      `SELECT * FROM inwards WHERE id = $1 AND purchase_source = 'night_arrival' FOR UPDATE`,
      [inwardId]
    );
    const inward = inwardR.rows[0];
    if (!inward) { const e = new Error('Night-arrival inward not found'); e.status = 404; throw e; }

    // All sales of this stock: pre-auction sales at the predetermined price
    const salesR = await client.query(
      `SELECT COALESCE(SUM(quantity),0) AS qty, COALESCE(SUM(quantity * rate),0) AS sales_value
       FROM pre_auction_sales WHERE lot_id IN (SELECT id FROM lots WHERE inward_id = $1)`,
      [inwardId]
    );
    const { qty, sales_value } = salesR.rows[0];
    const tradeMargin = Number(sales_value) - Number(qty) * rate;

    const updateR = await client.query(
      `UPDATE inwards SET final_rate = $2, trade_margin = $3 WHERE id = $1 RETURNING *`,
      [inwardId, rate, tradeMargin]
    );

    await writeAudit(client, {
      entity: 'inward', entityId: inwardId, action: 'fix_final_rate',
      oldData: { final_rate: inward.final_rate, trade_margin: inward.trade_margin },
      newData: { final_rate: rate, trade_margin: tradeMargin,
                 sold_quantity: Number(qty), sales_value: Number(sales_value) },
      changedBy: user?.id,
    });

    return updateR.rows[0];
  });
}

module.exports = { createInward, listInwards, consolidatedView, fixFinalRate, LOT_SELECT };
