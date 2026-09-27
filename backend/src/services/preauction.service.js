const { query, withTransaction } = require('../database/db');
const { addLotQuantity, findOrCreateCustomer, writeAudit, num } = require('./helpers');

/**
 * PRE-AUCTION: part of a lot sold before live auction.
 * remaining_quantity = total - pre_auction - allocated (generated column).
 * DB CHECKs make over-selling impossible.
 * Also used for NIGHT-ARRIVAL customer sales at the predetermined price
 * (the same stock identity continues; no duplicate inward).
 */
async function createPreAuctionSale(lotId, data, user) {
  const quantity = num(data.quantity, { required: true, min: 0.01 });
  const rate = num(data.rate, { required: true, min: 0 });

  return withTransaction(async (client) => {
    // Lock lot row to serialize concurrent writes
    const lockR = await client.query(
      `SELECT total_quantity, remaining_quantity FROM lots WHERE id = $1 FOR UPDATE`, [lotId]
    );
    const lotBefore = lockR.rows[0];
    if (!lotBefore) { const e = new Error('Lot not found'); e.status = 404; throw e; }

    const customer = await findOrCreateCustomer(client, {
      customerId: data.customer_id, customerName: data.customer_name, createdBy: user?.id,
    });

    // addLotQuantity UPDATE hits chk_lot_split/chk_lot_remaining when it would
    // over-sell -> transaction rolls back with a clear error.
    let lot;
    try {
      lot = await addLotQuantity(client, lotId, { preAuctionDelta: quantity });
    } catch (err) {
      if (err.code === '23514') {
        const e = new Error(
          `Pre-auction quantity exceeds available quantity. Requested ${quantity}, ` +
          `remaining ${lotBefore.remaining_quantity} of total ${lotBefore.total_quantity}.`
        );
        e.status = 409;
        throw e;
      }
      throw err;
    }

    const saleR = await client.query(
      `INSERT INTO pre_auction_sales (lot_id, customer_id, quantity, rate, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [lotId, customer.id, quantity, rate, user?.id || null]
    );

    if (lot.remaining_quantity === 0 && lot.status === 'created') {
      await client.query(`UPDATE lots SET status = 'pre_auctioned' WHERE id = $1`, [lotId]);
    }

    await writeAudit(client, {
      entity: 'pre_auction_sale', entityId: saleR.rows[0].id, action: 'create',
      newData: { lot_id: lotId, customer: customer.name, quantity, rate },
      changedBy: user?.id,
    });

    return { sale: saleR.rows[0], customer, lot };
  });
}

async function listPreAuctionSales({ date } = {}) {
  const r = await query(
    `SELECT ps.*, cu.name AS customer_name, l.lot_number
     FROM pre_auction_sales ps
     JOIN customers cu ON cu.id = ps.customer_id
     JOIN lots l ON l.id = ps.lot_id
     WHERE ($1::date IS NULL OR ps.sold_at = $1)
     ORDER BY ps.id DESC`,
    [date || null]
  );
  return r.rows;
}

module.exports = { createPreAuctionSale, listPreAuctionSales };
