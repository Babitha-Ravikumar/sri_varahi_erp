const { query } = require('../database/db');

// ---------- Vehicles ----------
async function listVehicles() {
  const r = await query(
    `SELECT v.*, count(l.id) AS lot_count
     FROM vehicles v
     LEFT JOIN lots l ON l.vehicle_id = v.id AND l.lot_date = current_date
     WHERE v.active
     GROUP BY v.id ORDER BY v.vehicle_number`
  );
  return r.rows;
}

async function createVehicle(data) {
  if (!data.vehicle_number || !String(data.vehicle_number).trim()) {
    const err = new Error('vehicle_number is required');
    err.status = 400;
    throw err;
  }
  const r = await query(
    `INSERT INTO vehicles (vehicle_number, vehicle_name, driver_name, driver_phone)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [String(data.vehicle_number).trim(), data.vehicle_name || null, data.driver_name || null, data.driver_phone || null]
  );
  return r.rows[0];
}

async function updateVehicle(id, data) {
  const r = await query(
    `UPDATE vehicles SET
       vehicle_number = COALESCE($2, vehicle_number),
       vehicle_name   = COALESCE($3, vehicle_name),
       driver_name    = COALESCE($4, driver_name),
       driver_phone   = COALESCE($5, driver_phone)
     WHERE id = $1 AND active RETURNING *`,
    [id, data.vehicle_number, data.vehicle_name, data.driver_name, data.driver_phone]
  );
  if (!r.rows[0]) { const e = new Error('Vehicle not found'); e.status = 404; throw e; }
  return r.rows[0];
}

/** Soft delete (deactivate) - keeps audit/history of lots that used the vehicle. */
async function deleteVehicle(id) {
  const r = await query(`UPDATE vehicles SET active = false WHERE id = $1 AND active RETURNING id, vehicle_number`, [id]);
  if (!r.rows[0]) { const e = new Error('Vehicle not found'); e.status = 404; throw e; }
  return r.rows[0];
}

// ---------- Parties ----------
async function listParties({ type, q } = {}) {
  const params = [];
  let where = 'WHERE active';
  if (type) { params.push(type); where += ` AND party_type = $${params.length}`; }
  if (q) { params.push(`%${q.toLowerCase()}%`); where += ` AND lower(name) LIKE $${params.length}`; }
  const r = await query(`SELECT * FROM parties ${where} ORDER BY name LIMIT 100`, params);
  return r.rows;
}

async function createParty(data) {
  if (!data.name || !String(data.name).trim()) {
    const err = new Error('name is required'); err.status = 400; throw err;
  }
  const r = await query(
    `INSERT INTO parties (name, party_type, phone, address)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [String(data.name).trim(), data.party_type || 'farmer', data.phone || null, data.address || null]
  );
  return r.rows[0];
}

async function updateParty(id, data) {
  const r = await query(
    `UPDATE parties SET
       name = COALESCE($2, name), phone = COALESCE($3, phone),
       address = COALESCE($4, address), party_type = COALESCE($5, party_type)
     WHERE id = $1 AND active RETURNING *`,
    [id, data.name, data.phone, data.address, data.party_type]
  );
  if (!r.rows[0]) { const e = new Error('Party not found'); e.status = 404; throw e; }
  return r.rows[0];
}

// ---------- Customers ----------
async function listCustomers({ q, incomplete } = {}) {
  const params = [];
  let where = 'WHERE active';
  if (q) { params.push(`%${q.toLowerCase()}%`); where += ` AND lower(name) LIKE $${params.length}`; }
  if (incomplete === 'true') where += ' AND NOT details_complete';
  const r = await query(`SELECT * FROM customers ${where} ORDER BY name LIMIT 100`, params);
  return r.rows;
}

async function createCustomer(data) {
  if (!data.name || !String(data.name).trim()) {
    const err = new Error('name is required'); err.status = 400; throw err;
  }
  const r = await query(
    `INSERT INTO customers (name, phone, address, details_complete)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [String(data.name).trim(), data.phone || null, data.address || null,
     Boolean(data.phone && data.address)]
  );
  return r.rows[0];
}

/** Complete details later (quick-created during auction). */
async function updateCustomer(id, data) {
  const r = await query(
    `UPDATE customers SET
       name = COALESCE($2, name), phone = COALESCE($3, phone), address = COALESCE($4, address)
     WHERE id = $1 AND active RETURNING *`,
    [id, data.name, data.phone, data.address]
  );
  if (!r.rows[0]) { const e = new Error('Customer not found'); e.status = 404; throw e; }
  if (r.rows[0].phone && r.rows[0].address) {
    await query('UPDATE customers SET details_complete = true WHERE id = $1', [id]);
    r.rows[0].details_complete = true;
  }
  return r.rows[0];
}

// ---------- Users (for login screen) ----------
async function listUsers() {
  const r = await query(`SELECT id, name, role FROM users WHERE active ORDER BY id`);
  return r.rows;
}

module.exports = {
  vehicles: { list: listVehicles, create: createVehicle, update: updateVehicle, remove: deleteVehicle },
  parties: { list: listParties, create: createParty, update: updateParty },
  customers: { list: listCustomers, create: createCustomer, update: updateCustomer },
  users: { list: listUsers },
};
