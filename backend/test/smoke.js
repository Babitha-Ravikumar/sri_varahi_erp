/** Quick smoke test of the running API (http://127.0.0.1:3000). */
const BASE = 'http://127.0.0.1:3000/api';
const HDRS = { 'Content-Type': 'application/json', 'X-User-Id': '3' }; // admin

async function req(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: HDRS, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

(async () => {
  console.log('health:', await req('GET', '/health'));

  // users exist?
  // create vehicle + party
  const veh = await req('POST', '/vehicles', { vehicle_number: 'AP36 AB 1234', vehicle_name: 'Tata Ace', driver_name: 'Ravi' });
  console.log('vehicle:', veh.id, veh.vehicle_number);

  // local farmer inward
  const farmer = await req('POST', '/inwards/local-farmer', {
    vehicle_id: veh.id, party_name: 'Koteswara Rao', quality: 'A Grade', quantity: 10,
  });
  console.log('local farmer lot:', farmer.lot.lot_number, 'remaining:', farmer.lot.remaining_quantity);

  // consolidated
  const cons = await req('GET', '/inwards/consolidated');
  console.log('consolidated:', JSON.stringify(cons));

  // pre-auction 5
  const pa = await req('POST', `/lots/${farmer.lot.id}/pre-auction`, { customer_name: 'Walk-in Customer', quantity: 5, rate: 95 });
  console.log('pre-auction ok, lot now:', JSON.stringify(pa.lot));

  // auction
  const auc = await req('POST', '/auctions', { lot_id: farmer.lot.id });
  console.log('auction opened:', auc.id, 'remaining:', auc.remaining_quantity);

  // allocations
  const a1 = await req('POST', `/auctions/${auc.id}/allocations`, { customer_name: 'Anil', quantity: 3, rate: 100 });
  console.log('alloc1:', a1.allocation.id, 'remaining:', a1.lot.remaining_quantity);
  const a2 = await req('POST', `/auctions/${auc.id}/allocations`, { customer_name: 'Sunil', quantity: 2, rate: 100 });
  console.log('alloc2:', a2.allocation.id, 'remaining:', a2.lot.remaining_quantity);

  // over-allocation must fail
  try {
    await req('POST', `/auctions/${auc.id}/allocations`, { customer_name: 'X', quantity: 1, rate: 90 });
    console.log('ERROR: over-allocation was allowed!');
  } catch (e) { console.log('over-allocation rejected OK:', e.message.slice(0, 90)); }

  // billing
  const bills = await req('POST', `/billing/auction/${auc.id}`);
  console.log('bills:', bills.map((b) => `${b.bill_number}=₹${b.total_amount}`).join(', '));

  // payment
  const pay = await req('POST', `/bills/${bills[0].id}/payments`, { amount: bills[0].total_amount, method: 'cash' });
  console.log('payment:', pay.bill_status);

  // correction: move 2 boxes from Anil to Sunil (supervisor required - admin ok)
  const tr = await req('POST', `/allocations/${a1.allocation.id}/transfer`, { to_customer_name: 'Sunil', quantity: 2, reason: 'customer request' });
  console.log('transfer ok:', JSON.stringify(tr.lot));

  const billAfter = await req('GET', `/bills/${bills[0].id}`);
  console.log('bill after correction:', billAfter.bill_number, 'total:', billAfter.total_amount, 'status:', billAfter.status);

  // audit
  const audit = await req('GET', '/audit?limit=5');
  console.log('audit entries:', audit.map((a) => `${a.entity}#${a.entity_id}:${a.action}`).join(', '));

  console.log('\nSMOKE TEST PASSED');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
