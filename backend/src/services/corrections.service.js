const { query, withTransaction } = require('../database/db');
const { writeAudit, recomputeLotQuantities, findOrCreateCustomer, num } = require('./helpers');

/**
 * POST-AUCTION CHANGES (authorized users only - enforced at the route).
 * Every correction:
 *   - validates against the lot's available quantity
 *   - recomputes lot totals from the allocation facts
 *   - re-syncs bills (items, totals, status) so Billing & Cashier follow
 *   - writes an audit row with before/after
 * The transaction is never restarted - the bill keeps its identity.
 *
 * Supported operations:
 *   updateAllocation  -> change customer / quantity (damage) / rate
 *   transferQuantity  -> move boxes from one customer to another
 *   splitAllocation   -> split one allocation across another customer (own rate)
 */

/** Ensure bill_items mirror current allocations; recompute bill totals/status. */
async function syncBills(client, auctionId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `B-${today}-`;

  const allocR = await client.query(
    `SELECT * FROM allocations WHERE auction_id = $1 ORDER BY id`, [auctionId]
  );
  const liveAllocs = allocR.rows.filter((a) => a.status !== 'cancelled');

  // Remove items of cancelled allocations
  await client.query(
    `DELETE FROM bill_items WHERE allocation_id IN (
       SELECT id FROM allocations WHERE auction_id = $1 AND status = 'cancelled')`,
    [auctionId]
  );

  for (const a of liveAllocs) {
    // find the customer's bill for this auction
    let bR = await client.query(
      `SELECT b.* FROM bills b WHERE b.auction_id = $1 AND b.customer_id = $2 FOR UPDATE`,
      [auctionId, a.customer_id]
    );
    let bill = bR.rows[0];

    if (!bill) {
      // customer got a NEW allocation after billing -> open a bill for them
      const lastR = await client.query(
        `SELECT bill_number FROM bills WHERE bill_number LIKE $1 ORDER BY bill_number DESC LIMIT 1`,
        [prefix + '%']
      );
      const seq = lastR.rows[0] ? Number(lastR.rows[0].bill_number.slice(prefix.length)) + 1 : 1;
      const nb = await client.query(
        `INSERT INTO bills (bill_number, auction_id, lot_id, customer_id, total_amount)
         VALUES ($1,$2,$3,$4,0) RETURNING *`,
        [prefix + String(seq).padStart(3, '0'), auctionId, a.lot_id, a.customer_id]
      );
      bill = nb.rows[0];
    }

    const itemR = await client.query(
      `SELECT * FROM bill_items WHERE allocation_id = $1`, [a.id]
    );
    const amount = Number(a.quantity) * Number(a.rate);
    if (itemR.rows[0] && itemR.rows[0].bill_id === bill.id) {
      await client.query(
        `UPDATE bill_items SET quantity = $2, rate = $3, amount = $4 WHERE id = $1`,
        [itemR.rows[0].id, a.quantity, a.rate, amount]
      );
    } else if (itemR.rows[0]) {
      // customer changed on a billed allocation -> move the item to their bill
      await client.query(
        `UPDATE bill_items SET bill_id = $2, quantity = $3, rate = $4, amount = $5 WHERE id = $1`,
        [itemR.rows[0].id, bill.id, a.quantity, a.rate, amount]
      );
    } else {
      await client.query(
        `INSERT INTO bill_items (bill_id, allocation_id, quantity, rate, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [bill.id, a.id, a.quantity, a.rate, amount]
      );
    }
  }

  // Recompute totals & status for all bills of this auction.
  // paid_amount is preserved; if it now exceeds the corrected total the bill
  // shows as paid and the excess remains as credit with the cashier.
  await client.query(
    `UPDATE bills b SET
       total_amount = COALESCE(items.total, 0),
       status = CASE
         WHEN COALESCE(items.total, 0) <= 0 THEN 'void'
         WHEN b.paid_amount >= COALESCE(items.total, 0) THEN 'paid'
         WHEN b.paid_amount > 0 THEN 'part_paid'
         ELSE 'unpaid' END
     FROM (SELECT bill_id, SUM(amount) AS total FROM bill_items GROUP BY bill_id) items
     WHERE items.bill_id = b.id AND b.auction_id = $1`,
    [auctionId]
  );
  // Bills for this auction with no items left -> void
  await client.query(
    `UPDATE bills SET status = 'void', total_amount = 0
     WHERE auction_id = $1 AND status <> 'void'
       AND id NOT IN (SELECT bill_id FROM bill_items)`,
    [auctionId]
  );
}

async function getAllocationForUpdate(client, allocationId) {
  const r = await client.query(`SELECT * FROM allocations WHERE id = $1 FOR UPDATE`, [allocationId]);
  const alloc = r.rows[0];
  if (!alloc) { const e = new Error('Allocation not found'); e.status = 404; throw e; }
  if (alloc.status === 'cancelled') { const e = new Error('Allocation is cancelled'); e.status = 409; throw e; }
  return alloc;
}

/** Change customer / quantity / rate on an existing allocation. */
async function updateAllocation(allocationId, data, user) {
  const quantity = data.quantity !== undefined ? num(data.quantity, { required: true, min: 0 }) : undefined;
  const rate = data.rate !== undefined ? num(data.rate, { required: true, min: 0 }) : undefined;
  if (quantity === 0) {
    const e = new Error('Use quantity 0 not allowed; set quantity > 0 or cancel via transfer of full quantity');
    e.status = 400;
    throw e;
  }
  if (!data.reason || !String(data.reason).trim()) {
    const e = new Error('A correction reason is required for the audit trail');
    e.status = 400;
    throw e;
  }

  return withTransaction(async (client) => {
    const alloc = await getAllocationForUpdate(client, allocationId);
    await client.query('SELECT id FROM lots WHERE id = $1 FOR UPDATE', [alloc.lot_id]);

    let customerId = alloc.customer_id;
    if (data.customer_id) {
      const c = await client.query('SELECT id, name FROM customers WHERE id = $1 AND active', [data.customer_id]);
      if (!c.rows[0]) { const e = new Error('Customer not found'); e.status = 404; throw e; }
      customerId = c.rows[0].id;
    }

    const old = { customer_id: alloc.customer_id, quantity: Number(alloc.quantity), rate: Number(alloc.rate) };

    await client.query(
      `UPDATE allocations SET customer_id = $2, quantity = $3, rate = $4 WHERE id = $1`,
      [allocationId, customerId, quantity ?? alloc.quantity, rate ?? alloc.rate]
    );

    // Recompute lot totals from facts - DB CHECK rejects over-allocation
    let lot;
    try {
      lot = await recomputeLotQuantities(client, alloc.lot_id);
    } catch (err) {
      if (err.code === '23514') {
        const e = new Error('Correction would over-allocate the lot; rejected.');
        e.status = 409;
        throw e;
      }
      throw err;
    }

    await syncBills(client, alloc.auction_id);

    const updated = (await client.query('SELECT * FROM allocations WHERE id = $1', [allocationId])).rows[0];
    await writeAudit(client, {
      entity: 'allocation', entityId: allocationId, action: 'correct',
      oldData: old,
      newData: { customer_id: customerId, quantity: Number(updated.quantity), rate: Number(updated.rate) },
      reason: data.reason, changedBy: user?.id,
    });

    return { allocation: updated, lot };
  });
}

/** Move quantity from one customer to another (same rate). */
async function transferQuantity(allocationId, data, user) {
  const qty = num(data.quantity, { required: true, min: 0.01 });
  if (!data.to_customer_id && !data.to_customer_name) {
    const e = new Error('Provide to_customer_id or to_customer_name'); e.status = 400; throw e;
  }
  if (!data.reason || !String(data.reason).trim()) {
    const e = new Error('A correction reason is required for the audit trail'); e.status = 400; throw e;
  }

  return withTransaction(async (client) => {
    const alloc = await getAllocationForUpdate(client, allocationId);
    await client.query('SELECT id FROM lots WHERE id = $1 FOR UPDATE', [alloc.lot_id]);

    if (qty > Number(alloc.quantity) + 0.0001) {
      const e = new Error(`Cannot transfer ${qty}; allocation only has ${alloc.quantity}`);
      e.status = 409;
      throw e;
    }

    const target = await findOrCreateCustomer(client, {
      customerId: data.to_customer_id, customerName: data.to_customer_name,
    });

    const old = { customer_id: alloc.customer_id, quantity: Number(alloc.quantity) };

    const remainingQty = Number(alloc.quantity) - qty;
    if (remainingQty <= 0.0001) {
      await client.query(`UPDATE allocations SET status = 'cancelled' WHERE id = $1`, [allocationId]);
    } else {
      await client.query(`UPDATE allocations SET quantity = $2 WHERE id = $1`, [allocationId, remainingQty]);
    }

    const nR = await client.query(
      `INSERT INTO allocations (auction_id, lot_id, customer_id, quantity, rate, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [alloc.auction_id, alloc.lot_id, target.id, qty, alloc.rate, user?.id || null]
    );

    const lot = await recomputeLotQuantities(client, alloc.lot_id);
    await syncBills(client, alloc.auction_id);

    await writeAudit(client, {
      entity: 'allocation', entityId: allocationId, action: 'transfer_out',
      oldData: old,
      newData: { quantity: remainingQty, transferred: qty, to_customer: target.name, new_allocation_id: nR.rows[0].id },
      reason: data.reason, changedBy: user?.id,
    });

    return { source_allocation_id: allocationId, new_allocation: nR.rows[0], lot };
  });
}

/** Split one allocation across another customer (may use a different rate). */
async function splitAllocation(allocationId, data, user) {
  const qty = num(data.quantity, { required: true, min: 0.01 });
  const rate = data.rate !== undefined ? num(data.rate, { required: true, min: 0 }) : undefined;
  if (!data.to_customer_id && !data.to_customer_name) {
    const e = new Error('Provide to_customer_id or to_customer_name'); e.status = 400; throw e;
  }
  if (!data.reason || !String(data.reason).trim()) {
    const e = new Error('A correction reason is required for the audit trail'); e.status = 400; throw e;
  }

  return withTransaction(async (client) => {
    const alloc = await getAllocationForUpdate(client, allocationId);
    await client.query('SELECT id FROM lots WHERE id = $1 FOR UPDATE', [alloc.lot_id]);

    if (qty >= Number(alloc.quantity)) {
      const e = new Error(`Split quantity must be less than allocation quantity (${alloc.quantity})`);
      e.status = 409;
      throw e;
    }

    const target = await findOrCreateCustomer(client, {
      customerId: data.to_customer_id, customerName: data.to_customer_name,
    });

    const old = { customer_id: alloc.customer_id, quantity: Number(alloc.quantity) };

    await client.query(
      `UPDATE allocations SET quantity = $2 WHERE id = $1`,
      [allocationId, Number(alloc.quantity) - qty]
    );
    const nR = await client.query(
      `INSERT INTO allocations (auction_id, lot_id, customer_id, quantity, rate, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [alloc.auction_id, alloc.lot_id, target.id, qty, rate ?? alloc.rate, user?.id || null]
    );

    const lot = await recomputeLotQuantities(client, alloc.lot_id);
    await syncBills(client, alloc.auction_id);

    await writeAudit(client, {
      entity: 'allocation', entityId: allocationId, action: 'split',
      oldData: old,
      newData: { quantity: Number(alloc.quantity) - qty, split_quantity: qty, to_customer: target.name, new_allocation_id: nR.rows[0].id },
      reason: data.reason, changedBy: user?.id,
    });

    return { source_allocation_id: allocationId, new_allocation: nR.rows[0], lot };
  });
}

module.exports = { updateAllocation, transferQuantity, splitAllocation };
