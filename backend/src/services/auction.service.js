const { query, withTransaction } = require('../database/db');
const { addLotQuantity, findOrCreateCustomer, writeAudit, num } = require('./helpers');

/**
 * LIVE AUCTION - high-speed flow:
 * open auction on a lot -> rate + customer + quantity on ONE screen ->
 * repeated allocations until remaining = 0.
 */

/** Open (or resume) the live auction for a lot. Only remaining quantity is auctionable. */
async function openAuction(lotId, user) {
  const auctionId = await withTransaction(async (client) => {
    const lotR = await client.query(
      `SELECT * FROM lots WHERE id = $1 FOR UPDATE`, [lotId]
    );
    const lot = lotR.rows[0];
    if (!lot) { const e = new Error('Lot not found'); e.status = 404; throw e; }
    if (lot.remaining_quantity <= 0) {
      const e = new Error('No remaining quantity to auction (lot fully sold via pre-auction/allocations)');
      e.status = 409;
      throw e;
    }

    const existing = await client.query(
      `SELECT * FROM auctions WHERE lot_id = $1 AND status = 'live'`, [lotId]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const aR = await client.query(
      `INSERT INTO auctions (lot_id, created_by) VALUES ($1,$2) RETURNING id`,
      [lotId, user?.id || null]
    );
    await client.query(`UPDATE lots SET status = 'in_auction' WHERE id = $1`, [lotId]);
    return aR.rows[0].id;
  });
  // detail read after commit so it sees the new auction
  return auctionDetail(auctionId);
}

/** Full auction context: lot details auto-appear + existing allocations + totals. */
async function auctionDetail(auctionId) {
  const aR = await query(
    `SELECT a.*, l.id AS lot_id, l.lot_number, l.total_quantity, l.pre_auction_quantity,
            l.allocated_quantity, l.remaining_quantity, l.quality,
            v.vehicle_number, v.vehicle_name, p.name AS party_name
     FROM auctions a
     JOIN lots l ON l.id = a.lot_id
     LEFT JOIN vehicles v ON v.id = l.vehicle_id
     LEFT JOIN parties p ON p.id = l.party_id
     WHERE a.id = $1`,
    [auctionId]
  );
  if (!aR.rows[0]) { const e = new Error('Auction not found'); e.status = 404; throw e; }
  const auction = aR.rows[0];

  const allocR = await query(
    `SELECT a.*, c.name AS customer_name FROM allocations a
     JOIN customers c ON c.id = a.customer_id
     WHERE a.auction_id = $1 AND a.status <> 'cancelled' ORDER BY a.id`,
    [auctionId]
  );

  return {
    ...auction,
    allocations: allocR.rows,
    total_allocated_quantity: allocR.rows.reduce((s, a) => s + Number(a.quantity), 0),
  };
}

/** Allocate customer <- quantity @ rate. SINGLE-SAVE, minimal taps. */
async function createAllocation(auctionId, data, user) {
  const quantity = num(data.quantity, { required: true, min: 0.01 });
  const rate = num(data.rate, { required: true, min: 0 });

  return withTransaction(async (client) => {
    const aR = await client.query(
      `SELECT * FROM auctions WHERE id = $1 AND status = 'live' FOR UPDATE`, [auctionId]
    );
    if (!aR.rows[0]) {
      const e = new Error('Live auction not found (it may be closed)');
      e.status = 404;
      throw e;
    }
    const auction = aR.rows[0];

    const lockR = await client.query(
      `SELECT remaining_quantity FROM lots WHERE id = $1 FOR UPDATE`, [auction.lot_id]
    );
    const beforeRemaining = lockR.rows[0].remaining_quantity;

    const customer = await findOrCreateCustomer(client, {
      customerId: data.customer_id, customerName: data.customer_name, createdBy: user?.id,
    });

    // Over-allocation is rejected by the lots CHECK constraints (23514)
    let lot;
    try {
      lot = await addLotQuantity(client, auction.lot_id, { allocatedDelta: quantity });
    } catch (err) {
      if (err.code === '23514') {
        const e = new Error(
          `Allocation exceeds remaining quantity. Requested ${quantity}, remaining ${beforeRemaining}.`
        );
        e.status = 409;
        throw e;
      }
      throw err;
    }

    const allocR = await client.query(
      `INSERT INTO allocations (auction_id, lot_id, customer_id, quantity, rate, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [auctionId, auction.lot_id, customer.id, quantity, rate, user?.id || null]
    );

    if (lot.remaining_quantity === 0) {
      await client.query(`UPDATE lots SET status = 'allocated' WHERE id = $1 AND status = 'in_auction'`, [auction.lot_id]);
    }

    return { allocation: allocR.rows[0], customer, lot };
  });
}

/** Close auction (optional - remaining qty can still be auctioned later by reopening). */
async function closeAuction(auctionId, user) {
  return withTransaction(async (client) => {
    const r = await client.query(
      `UPDATE auctions SET status = 'closed', closed_at = now()
       WHERE id = $1 AND status = 'live' RETURNING *`,
      [auctionId]
    );
    if (!r.rows[0]) { const e = new Error('Live auction not found'); e.status = 404; throw e; }
    await client.query(
      `UPDATE lots SET status = CASE WHEN remaining_quantity <= 0 THEN 'closed' ELSE 'allocated' END
       WHERE id = $1`, [r.rows[0].lot_id]
    );
    await writeAudit(client, {
      entity: 'auction', entityId: auctionId, action: 'close',
      newData: { closed: true }, changedBy: user?.id,
    });
    return r.rows[0];
  });
}

async function listAuctions({ date, status } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (date) { params.push(date); where += ` AND a.opened_at::date = $${params.length}`; }
  else where += ` AND a.opened_at::date = current_date`;
  if (status) { params.push(status); where += ` AND a.status = $${params.length}`; }
  const r = await query(
    `SELECT a.*, l.lot_number, l.total_quantity, l.remaining_quantity
     FROM auctions a JOIN lots l ON l.id = a.lot_id
     ${where} ORDER BY a.opened_at DESC`,
    params
  );
  return r.rows;
}

module.exports = { openAuction, auctionDetail, createAllocation, closeAuction, listAuctions };
