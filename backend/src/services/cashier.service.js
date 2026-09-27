const { query, withTransaction } = require('../database/db');
const { writeAudit, num } = require('./helpers');

/** CASHIER - record payment against a bill; status updates automatically.
 *  method: cash | upi | bank. reference: UPI/bank details (optional text). */
async function recordPayment(billId, { amount, method, reference }, user) {
  const amt = num(amount, { required: true, min: 0.01 });
  const m = ['cash', 'upi', 'bank'].includes(method) ? method : 'cash';
  return withTransaction(async (client) => {
    const bR = await client.query(
      `SELECT * FROM bills WHERE id = $1 AND status <> 'void' FOR UPDATE`, [billId]
    );
    const bill = bR.rows[0];
    if (!bill) { const e = new Error('Bill not found'); e.status = 404; throw e; }

    const balance = Number(bill.total_amount) - Number(bill.paid_amount);
    if (amt > balance + 0.0001) {
      const e = new Error(`Payment exceeds balance. Balance: ${balance}`);
      e.status = 409;
      throw e;
    }

    const pR = await client.query(
      `INSERT INTO payments (bill_id, amount, method, reference, received_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [billId, amt, m, reference || null, user?.id || null]
    );

    const newPaid = Number(bill.paid_amount) + amt;
    const status = newPaid >= Number(bill.total_amount) - 0.0001 ? 'paid' : 'part_paid';
    await client.query(
      `UPDATE bills SET paid_amount = $2, status = $3 WHERE id = $1`,
      [billId, newPaid, status]
    );
    if (status === 'paid') {
      await client.query(
        `UPDATE allocations SET status = 'paid' WHERE id IN
         (SELECT allocation_id FROM bill_items WHERE bill_id = $1)`,
        [billId]
      );
    }

    await writeAudit(client, {
      entity: 'bill', entityId: billId, action: 'payment',
      newData: { amount: amt, method: m, reference: reference || null, bill_status: status },
      changedBy: user?.id,
    });

    return { payment: pR.rows[0], bill_status: status, balance: Number(bill.total_amount) - newPaid };
  });
}

/** Daily cashier summary. */
async function cashierSummary({ date } = {}) {
  const d = date || null;
  const totals = await query(
    `SELECT COALESCE(SUM(amount),0) AS collected, count(*) AS payment_count
     FROM payments WHERE ($1::date IS NULL OR received_at::date = $1)`,
    [d]
  );
  const byMethod = await query(
    `SELECT method, SUM(amount) AS amount, count(*) AS count
     FROM payments WHERE ($1::date IS NULL OR received_at::date = $1)
     GROUP BY method`,
    [d]
  );
  const pending = await query(
    `SELECT count(*) AS bill_count, COALESCE(SUM(total_amount - paid_amount),0) AS outstanding
     FROM bills WHERE status IN ('unpaid','part_paid')
       AND ($1::date IS NULL OR created_at::date = $1)`,
    [d]
  );
  return {
    date: d || new Date().toISOString().slice(0, 10),
    collected: Number(totals.rows[0].collected),
    payment_count: Number(totals.rows[0].payment_count),
    by_method: byMethod.rows,
    outstanding_bills: Number(pending.rows[0].bill_count),
    outstanding_amount: Number(pending.rows[0].outstanding),
  };
}

module.exports = { recordPayment, cashierSummary };
