/**
 * DATA CLEANUP - clears ALL application data while keeping the users table
 * (logins, roles, passwords) COMPLETELY UNTOUCHED, along with the migration
 * history. Id sequences are reset so lot/bill numbering starts fresh.
 *
 * Usage: npm run cleanup   (in backend/)
 *
 * Tables cleared: vehicles, parties, customers, inwards, lots, lot_cards,
 * pre_auction_sales, auctions, allocations, bills, bill_items, payments,
 * audit_log, password_reset_otps.
 * Tables PRESERVED: users, schema_migrations.
 */
const config = require('../config/env');
const { pool } = require('./db');

// EVERY application table EXCEPT users (and schema_migrations).
const TABLES_TO_CLEAR = [
  'payments', 'bill_items', 'bills', 'allocations', 'auctions',
  'pre_auction_sales', 'lot_cards', 'lots', 'inwards',
  'customers', 'parties', 'vehicles',
  'audit_log', 'password_reset_otps',
];

async function run() {
  const schema = config.db.schema;
  const list = TABLES_TO_CLEAR.map((t) => `${schema}.${t}`).join(', ');

  // Safety check: users must never appear in the clear list.
  if (TABLES_TO_CLEAR.some((t) => t === 'users')) {
    throw new Error('Refusing to run: users table found in clear list');
  }

  await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  const users = await pool.query(`SELECT count(*) AS n FROM ${schema}.users`);
  console.log(`Cleanup complete. Application tables cleared (IDs reset).`);
  console.log(`Users table untouched: ${users.rows[0].n} user(s) still present.`);
}

if (require.main === module) {
  run()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Cleanup failed:', err.message);
      process.exit(1);
    });
}

module.exports = run;
