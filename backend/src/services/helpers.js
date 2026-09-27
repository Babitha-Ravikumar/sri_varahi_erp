/**
 * Shared business helpers used by services.
 * All lot quantity writes go through these to stay consistent.
 */

/** Write an audit row (inside the caller's transaction). */
async function writeAudit(client, { entity, entityId, action, oldData, newData, reason, changedBy }) {
  await client.query(
    `INSERT INTO audit_log (entity, entity_id, action, old_data, new_data, reason, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entity, entityId, action, JSON.stringify(oldData || null), JSON.stringify(newData || null), reason || null, changedBy || null]
  );
}

/** Generate the next lot number for today: L-YYYYMMDD-NNN (call inside transaction).
 *  The sequence is ALWAYS exactly 3 digits (001-999); the 999-lot daily limit
 *  is enforced here and by the chk_lot_number_format DB constraint.
 */
async function nextLotNumber(client) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `L-${today}-`;
  const r = await client.query(
    `SELECT lot_number FROM lots WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
    [prefix + '%']
  );
  let seq = 1;
  if (r.rows[0]) {
    seq = Number(r.rows[0].lot_number.slice(prefix.length)) + 1;
  }
  if (!Number.isInteger(seq) || seq < 1 || seq > 999) {
    const err = new Error('Daily lot limit reached: lot numbers allow exactly 3 digits (max 999 per day)');
    err.status = 409;
    throw err;
  }
  return prefix + String(seq).padStart(3, '0');
}

/**
 * Lock the lot row, then bump pre_auction_quantity / allocated_quantity.
 * The DB CHECK (chk_lot_split / chk_lot_remaining) rejects over-allocation,
 * so negative remaining quantity is impossible at the storage level.
 */
async function addLotQuantity(client, lotId, { preAuctionDelta = 0, allocatedDelta = 0 }) {
  const r = await client.query(
    `UPDATE lots SET
       pre_auction_quantity = pre_auction_quantity + $2,
       allocated_quantity = allocated_quantity + $3
     WHERE id = $1
     RETURNING id, lot_number, total_quantity, pre_auction_quantity,
               allocated_quantity, remaining_quantity, status`,
    [lotId, preAuctionDelta, allocatedDelta]
  );
  if (!r.rows[0]) {
    const err = new Error('Lot not found');
    err.status = 404;
    throw err;
  }
  return r.rows[0];
}

/**
 * Recompute lots.pre_auction_quantity / allocated_quantity from child rows.
 * Used by post-auction corrections so totals are always derived from facts.
 */
async function recomputeLotQuantities(client, lotId) {
  const r = await client.query(
    `UPDATE lots l SET
       pre_auction_quantity = COALESCE(p.qty, 0),
       allocated_quantity   = COALESCE(a.qty, 0)
     FROM lots l2
     LEFT JOIN (SELECT lot_id, SUM(quantity) qty FROM pre_auction_sales GROUP BY lot_id) p ON p.lot_id = l2.id
     LEFT JOIN (SELECT lot_id, SUM(quantity) qty FROM allocations WHERE status <> 'cancelled' GROUP BY lot_id) a ON a.lot_id = l2.id
     WHERE l2.id = $1 AND l.id = l2.id
     RETURNING l.id, l.lot_number, l.total_quantity, l.pre_auction_quantity,
               l.allocated_quantity, l.remaining_quantity, l.status`,
    [lotId]
  );
  return r.rows[0];
}

/** Find an existing customer by name (case-insensitive) or create one quickly. */
async function findOrCreateCustomer(client, { customerId, customerName, createdBy }) {
  if (customerId) {
    const r = await client.query('SELECT id, name FROM customers WHERE id = $1 AND active', [customerId]);
    if (!r.rows[0]) {
      const err = new Error('Customer not found');
      err.status = 404;
      throw err;
    }
    return r.rows[0];
  }
  if (!customerName || !customerName.trim()) {
    const err = new Error('Provide customer_id or customer_name');
    err.status = 400;
    throw err;
  }
  const existing = await client.query(
    'SELECT id, name FROM customers WHERE lower(name) = lower($1) AND active LIMIT 1',
    [customerName.trim()]
  );
  if (existing.rows[0]) return existing.rows[0];
  const created = await client.query(
    'INSERT INTO customers (name, details_complete) VALUES ($1, false) RETURNING id, name',
    [customerName.trim()]
  );
  return created.rows[0];
}

/** Same as above for parties (farmers / traders / suppliers). */
async function findOrCreateParty(client, { partyId, partyName, partyType }) {
  if (partyId) {
    const r = await client.query('SELECT id, name FROM parties WHERE id = $1 AND active', [partyId]);
    if (!r.rows[0]) {
      const err = new Error('Party not found');
      err.status = 404;
      throw err;
    }
    return r.rows[0];
  }
  if (!partyName || !partyName.trim()) {
    const err = new Error('Provide party_id or party_name');
    err.status = 400;
    throw err;
  }
  const existing = await client.query(
    'SELECT id, name FROM parties WHERE lower(name) = lower($1) AND active LIMIT 1',
    [partyName.trim()]
  );
  if (existing.rows[0]) return existing.rows[0];
  const created = await client.query(
    'INSERT INTO parties (name, party_type) VALUES ($1, $2) RETURNING id, name',
    [partyName.trim(), partyType]
  );
  return created.rows[0];
}

/** Positive-number body validation helper. */
function num(v, { min = 0, required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new Error('Missing required numeric field');
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) {
    const err = new Error(`Invalid number: ${v} (must be >= ${min})`);
    err.status = 400;
    throw err;
  }
  return n;
}

module.exports = {
  writeAudit,
  nextLotNumber,
  addLotQuantity,
  recomputeLotQuantities,
  findOrCreateCustomer,
  findOrCreateParty,
  num,
};
