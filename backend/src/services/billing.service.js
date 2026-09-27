const { query, withTransaction } = require('../database/db');
const { writeAudit } = require('./helpers');
const { renderBillPdf } = require('./pdf.service');

/**
 * BILLING - receives allocation data automatically.
 * One bill per customer per auction; allocations marked 'billed'.
 * NO duplicate re-entry: items are built from allocations.
 */
async function generateBillsForAuction(auctionId, user) {
  return withTransaction(async (client) => {
    const aR = await client.query(`SELECT * FROM auctions WHERE id = $1 FOR UPDATE`, [auctionId]);
    if (!aR.rows[0]) { const e = new Error('Auction not found'); e.status = 404; throw e; }

    const allocR = await client.query(
      `SELECT * FROM allocations WHERE auction_id = $1 AND status = 'allocated' ORDER BY id`,
      [auctionId]
    );
    if (allocR.rows.length === 0) {
      const e = new Error('No un-billed allocations for this auction');
      e.status = 409;
      throw e;
    }

    // Next bill number for today
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `B-${today}-`;
    const lastR = await client.query(
      `SELECT bill_number FROM bills WHERE bill_number LIKE $1 ORDER BY bill_number DESC LIMIT 1`,
      [prefix + '%']
    );
    let seq = lastR.rows[0] ? Number(lastR.rows[0].bill_number.slice(prefix.length)) + 1 : 1;

    // Group allocations by customer
    const byCustomer = new Map();
    for (const a of allocR.rows) {
      if (!byCustomer.has(a.customer_id)) byCustomer.set(a.customer_id, []);
      byCustomer.get(a.customer_id).push(a);
    }

    const bills = [];
    for (const [customerId, allocs] of byCustomer) {
      const billNumber = prefix + String(seq++).padStart(3, '0');
      const total = allocs.reduce((s, a) => s + Number(a.quantity) * Number(a.rate), 0);
      const bR = await client.query(
        `INSERT INTO bills (bill_number, auction_id, lot_id, customer_id, total_amount)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [billNumber, auctionId, aR.rows[0].lot_id, customerId, total]
      );
      const bill = bR.rows[0];
      for (const a of allocs) {
        await client.query(
          `INSERT INTO bill_items (bill_id, allocation_id, quantity, rate, amount)
           VALUES ($1,$2,$3,$4,$5)`,
          [bill.id, a.id, a.quantity, a.rate, Number(a.quantity) * Number(a.rate)]
        );
        await client.query(`UPDATE allocations SET status = 'billed' WHERE id = $1`, [a.id]);
      }
      bills.push(bill);
    }

    await writeAudit(client, {
      entity: 'auction', entityId: auctionId, action: 'generate_bills',
      newData: { bills: bills.map((b) => ({ id: b.id, bill_number: b.bill_number, total: b.total_amount })) },
      changedBy: user?.id,
    });

    return bills;
  });
}

async function listBills({ date, status, customer_id } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (date) { params.push(date); where += ` AND b.created_at::date = $${params.length}`; }
  else where += ` AND b.created_at::date = current_date`;
  if (status) { params.push(status); where += ` AND b.status = $${params.length}`; }
  if (customer_id) { params.push(customer_id); where += ` AND b.customer_id = $${params.length}`; }
  const r = await query(
    `SELECT b.*, c.name AS customer_name, l.lot_number, a.id AS auction_id
     FROM bills b
     JOIN customers c ON c.id = b.customer_id
     JOIN lots l ON l.id = b.lot_id
     JOIN auctions a ON a.id = b.auction_id
     ${where} ORDER BY b.id DESC`,
    params
  );
  return r.rows;
}

async function billDetail(billId) {
  const bR = await query(
    `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone,
            l.lot_number, a.id AS auction_id
     FROM bills b
     JOIN customers c ON c.id = b.customer_id
     JOIN lots l ON l.id = b.lot_id
     JOIN auctions a ON a.id = b.auction_id
     WHERE b.id = $1`,
    [billId]
  );
  if (!bR.rows[0]) { const e = new Error('Bill not found'); e.status = 404; throw e; }
  const itemsR = await query(
    `SELECT bi.*, al.customer_id FROM bill_items bi
     JOIN allocations al ON al.id = bi.allocation_id WHERE bi.bill_id = $1`,
    [billId]
  );
  const payR = await query(
    `SELECT * FROM payments WHERE bill_id = $1 ORDER BY id`, [billId]
  );
  return { ...bR.rows[0], items: itemsR.rows, payments: payR.rows, balance: Number(bR.rows[0].total_amount) - Number(bR.rows[0].paid_amount) };
}

/** Render a bill as a downloadable PDF (Sri Varahi branded). */
async function billPdf(billId) {
  const detail = await billDetail(billId);
  const buffer = renderBillPdf(detail);
  return { filename: `${detail.bill_number}.pdf`, buffer };
}

module.exports = { generateBillsForAuction, listBills, billDetail, billPdf };
