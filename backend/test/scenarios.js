/**
 * Module 1 - REAL-LIFE TEST SCENARIOS (runs against a live backend + DB).
 * Covers all 7 required scenarios plus master flows for all 4 purchase sources.
 *
 * Run: node test/reset.js  (optional, clean slate)  then  npm run test:scenarios
 */
const BASE = 'http://127.0.0.1:3000/api';

function client(userId) {
  return {
    userId,
    async req(method, path, body) {
      const res = await fetch(BASE + path, {
        method, headers: { 'Content-Type': 'application/json', 'X-User-Id': String(this.userId) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { const e = new Error(`${method} ${path} -> ${res.status}: ${j.error}`); e.status = res.status; throw e; }
      return j;
    },
  };
}

const OPERATOR = client(1), SUPERVISOR = client(2);
const eq = (a, b, msg) => {
  if (Math.abs(Number(a) - Number(b)) > 0.0001) throw new Error(`FAIL ${msg}: expected ${b}, got ${a}`);
  console.log(`  ok: ${msg} = ${Number(a)}`);
};
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
};

(async () => {
  console.log('\n== SETUP: masters + all four purchase sources ==');
  const veh = await OPERATOR.req('POST', '/vehicles', { vehicle_number: 'AP01 AA 1111', vehicle_name: 'Tata Ace', driver_name: 'Ravi', driver_phone: '9800000001' });
  ok(veh.id > 0, 'vehicle master created');

  // 1. LOCAL FARMER
  const farmer = await OPERATOR.req('POST', '/inwards/local-farmer', { vehicle_id: veh.id, party_name: 'Farmer Koteswara Rao', quality: 'A Grade', quantity: 10 });
  ok(/L-\d{8}-\d{3}/.test(farmer.lot.lot_number), `local farmer lot auto-numbered ${farmer.lot.lot_number}`);
  ok(farmer.lot.remaining_quantity == 10, 'farmer lot remaining = 10');
  const lotA = farmer.lot.id;

  // 2. LOCAL TRADER
  const trader = await OPERATOR.req('POST', '/inwards/local-trader', { party_name: 'Srinu Traders', quantity: 15, purchase_rate: 88 });
  eq(trader.lot.total_quantity, 15, 'local trader lot qty');
  eq(trader.inward.purchase_rate, 88, 'local trader purchase rate stored');

  // 3. OUTSIDE TRADER (vehicle + driver captured per arrival)
  const outside = await OPERATOR.req('POST', '/inwards/outside-trader', {
    party_name: 'Vijaya Fruits Bangalore', vehicle_number: 'KA05 AB 4321', vehicle_name: 'Eicher',
    driver_name: 'Mahesh', driver_phone: '9800000002', quality: 'B Grade', quantity: 30,
  });
  ok(outside.inward.vehicle_number === 'KA05 AB 4321', 'outside trader vehicle captured per-arrival');
  eq(outside.lot.total_quantity, 30, 'outside trader lot qty');

  // 4. NIGHT ARRIVAL (scenario 7 setup)
  const night = await OPERATOR.req('POST', '/inwards/night-arrival', {
    party_name: 'Night Supplier', vehicle_number: 'AP21 CD 7788', driver_name: 'Night Driver',
    quality: 'C Grade', quantity: 20, selling_price: 110,
  });
  const nightLotId = night.lot.id;
  const nightInwardId = night.inward.id;

  // consolidated view derived from inward data only
  const cons = await OPERATOR.req('GET', '/inwards/consolidated');
  eq(cons.today_total_lots, 4, 'consolidated: 4 lots today');
  eq(cons.today_total_boxes, 75, 'consolidated: 75 boxes today');
  const ap21 = cons.vehicle_wise.find((v) => v.vehicle_number === 'AP21 CD 7788');
  eq(ap21.lot_count, 1, 'consolidated: vehicle-wise lot count');

  console.log('\n== SCENARIO 6: pre-auction taken, only remaining enters live auction ==');
  const pa = await OPERATOR.req('POST', `/lots/${lotA}/pre-auction`, { customer_name: 'Early Buyer', quantity: 5, rate: 95 });
  eq(pa.lot.remaining_quantity, 5, 'remaining 10-5=5 after pre-auction');
  let aucA = await OPERATOR.req('POST', '/auctions', { lot_id: lotA });
  eq(aucA.remaining_quantity, 5, 'auction sees only remaining 5');
  try {
    await OPERATOR.req('POST', `/auctions/${aucA.id}/allocations`, { customer_name: 'Greedy', quantity: 6, rate: 100 });
    throw new Error('over-allocation was allowed!');
  } catch (e) { ok(e.status === 409, 'over-allocation beyond remaining rejected (409)'); }

  console.log('\n== SCENARIO 5: new customer joins during auction, name captured quickly ==');
  const allocA1 = await OPERATOR.req('POST', `/auctions/${aucA.id}/allocations`, { customer_name: 'Anil', quantity: 3, rate: 100 });
  const anilCust = (await OPERATOR.req('GET', '/customers?q=anil')).find((c) => c.name === 'Anil');
  ok(anilCust && anilCust.details_complete === false, 'new customer created instantly, details pending (completable later)');
  const custCompleted = await OPERATOR.req('PUT', `/customers/${anilCust.id}`, { phone: '9812345670', address: 'Main Rd' });
  ok(custCompleted.details_complete === true, 'customer details completed later without blocking auction');
  const allocA2 = await OPERATOR.req('POST', `/auctions/${aucA.id}/allocations`, { customer_name: 'Sunil', quantity: 2, rate: 100 });
  eq(allocA2.lot.remaining_quantity, 0, 'lot fully allocated (3+2 of 5)');

  console.log('\n== Billing + Cashier receive allocation data automatically ==');
  const billsA = await OPERATOR.req('POST', `/billing/auction/${aucA.id}`);
  ok(billsA.length === 2, 'one bill per customer (2 bills)');
  const anilBill = billsA.find((b) => b.customer_id === allocA1.customer.id);
  const sunilBill = billsA.find((b) => b.customer_id === allocA2.customer.id);
  eq(anilBill.total_amount, 300, 'Anil bill = 3 x 100');
  eq(sunilBill.total_amount, 200, 'Sunil bill = 2 x 100');
  await SUPERVISOR.req('POST', `/bills/${anilBill.id}/payments`, { amount: 300, method: 'cash' });
  const anilBillD = await OPERATOR.req('GET', `/bills/${anilBill.id}`);
  ok(anilBillD.status === 'paid', 'cashier: Anil bill paid');
  try {
    await SUPERVISOR.req('POST', `/bills/${anilBill.id}/payments`, { amount: 10, method: 'cash' });
    throw new Error('over-payment allowed!');
  } catch (e) { ok(e.status === 409, 'payment beyond balance rejected'); }

  console.log('\n== SCENARIO 1: 10 boxes to A, later 5 moved to B (here: 3 to Anil, 2 moved to new customer Bala) ==');
  // give Anil more: use the 30-box outside trader lot
  const aucB = await OPERATOR.req('POST', '/auctions', { lot_id: outside.lot.id });
  const bigAlloc = await OPERATOR.req('POST', `/auctions/${aucB.id}/allocations`, { customer_id: allocA1.customer.id, quantity: 10, rate: 120 });
  eq(bigAlloc.lot.allocated_quantity, 10, 'Customer A has 10 boxes');
  const moved = await SUPERVISOR.req('POST', `/allocations/${bigAlloc.allocation.id}/transfer`, { to_customer_name: 'Bala', quantity: 5, reason: 'moved to Bala per request' });
  eq(moved.new_allocation.quantity, 5, 'Bala received 5 boxes');
  eq(moved.lot.allocated_quantity, 10, 'lot totals still consistent (5+5)');

  console.log('\n== SCENARIO 2: quantity reduced because of damage ==');
  const dmg = await SUPERVISOR.req('PATCH', `/allocations/${moved.new_allocation.id}`, { quantity: 4, reason: '1 box damaged in transit' });
  eq(dmg.lot.allocated_quantity, 9, 'damaged: totals recalculated (5+4)');
  eq(dmg.lot.remaining_quantity, 21, 'remaining back to 21 after damage correction');

  console.log('\n== SCENARIO 3: rate change after auction ==');
  const rc = await SUPERVISOR.req('PATCH', `/allocations/${bigAlloc.allocation.id}`, { rate: 115, reason: 'rate corrected with party' });
  eq(rc.allocation.rate, 115, 'rate updated to 115');

  console.log('\n== Billing follows corrections automatically ==');
  const billsB = await OPERATOR.req('POST', `/billing/auction/${aucB.id}`);
  const balaBill = billsB.find((b) => b.customer_id === moved.new_allocation.customer_id);
  eq(balaBill.total_amount, 4 * 120, 'Bala bill auto-updated after damage = 4 x 120 = 480');
  const anilBillB = billsB.find((b) => b.customer_id === allocA1.customer.id);
  eq(anilBillB.total_amount, 5 * 115, 'A(Anil) bill auto-updated to 5 x 115 = 575');

  console.log('\n== SCENARIO 4: one allocation split across multiple customers ==');
  const split = await SUPERVISOR.req('POST', `/allocations/${bigAlloc.allocation.id}/split`, { to_customer_name: 'Charan', quantity: 2, reason: 'split for resale' });
  eq(split.lot.allocated_quantity, 9, 'after split: 3+2+4 = 9 still consistent');
  const billsB2 = await OPERATOR.req('GET', `/bills`);
  const charanBill = billsB2.find((b) => b.customer_id === split.new_allocation.customer_id);
  eq(charanBill.total_amount, 2 * 115, 'Charan bill created automatically = 230');

  console.log('\n== Authorization: operator cannot correct ==');
  try {
    await OPERATOR.req('PATCH', `/allocations/${bigAlloc.allocation.id}`, { rate: 90, reason: 'try' });
    throw new Error('operator was allowed to correct!');
  } catch (e) { ok(e.status === 403, 'operator blocked from corrections (403)'); }

  console.log('\n== Audit trail preserved ==');
  const audit = await OPERATOR.req('GET', '/audit?entity=allocation&limit=50');
  const actions = audit.map((a) => a.action);
  ok(actions.includes('transfer_out'), 'audit: transfer recorded');
  ok(actions.includes('correct'), 'audit: corrections recorded');
  ok(actions.includes('split'), 'audit: split recorded');
  ok(audit.every((a) => a.reason), 'every correction carries a reason');

  console.log('\n== SCENARIO 7: night stock sold at predetermined price before final rate ==');
  const n1 = await OPERATOR.req('POST', `/lots/${nightLotId}/pre-auction`, { customer_name: 'Night Cust 1', quantity: 12, rate: 110 });
  const n2 = await OPERATOR.req('POST', `/lots/${nightLotId}/pre-auction`, { customer_name: 'Night Cust 2', quantity: 8, rate: 110 });
  ok(n1.lot.id === n2.lot.id, 'same stock identity continues (no duplicate inward)');
  eq(n2.lot.pre_auction_quantity, 20, 'all 20 boxes sold to multiple customers');
  const fixed = await SUPERVISOR.req('POST', `/inwards/${nightInwardId}/final-rate`, { final_rate: 100 });
  eq(fixed.trade_margin, 20 * 110 - 20 * 100, `trade margin = 2200 - 2000 = 200 (got ${fixed.trade_margin})`);
  const nightInwards = await OPERATOR.req('GET', '/inwards?source=night_arrival');
  const mine = nightInwards.filter((i) => i.id === nightInwardId);
  ok(mine.length === 1, 'still exactly ONE inward row for the night arrival');

  console.log('\n== Negative-quantity / consistency guards ==');
  try {
    await OPERATOR.req('POST', `/lots/${trader.lot.id}/pre-auction`, { customer_name: 'X', quantity: 16, rate: 50 });
    throw new Error('pre-auction over-sell allowed!');
  } catch (e) { ok(e.status === 409, 'pre-auction over-sell rejected'); }
  const lotAD = await OPERATOR.req('GET', `/lots/${lotA}`);
  eq(lotAD.total_quantity - lotAD.pre_auction_quantity - lotAD.allocated_quantity, lotAD.remaining_quantity, 'remaining = total - pre - allocated (invariant)');

  console.log('\n==========================================');
  console.log('ALL 7 REAL-LIFE SCENARIOS PASSED ✓');
  console.log('==========================================');
  process.exit(0);
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
