/**
 * Seed: ensures the default Super Admin exists with a fixed username
 * and a securely hashed password (never plain text).
 * Legacy role-demo users (operator/supervisor/admin) are still ensured
 * for referential demo data, but they carry no credentials and cannot
 * log in until the Super Admin creates real users for them.
 */
const { pool } = require('./db');
const config = require('../config/env');
const { hashPassword } = require('../services/auth.service');

// Default Super Admin credentials (documented in README).
const SUPER_ADMIN_USERNAME = 'superadmin';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@123';

async function run() {
  const schema = config.db.schema;

  // Default Super Admin (only created once; password is never overwritten).
  await pool.query(
    `INSERT INTO ${schema}.users (name, username, role, password_hash, must_change_password)
     SELECT $1, $2, 'super_admin', $3, false
     WHERE NOT EXISTS (
       SELECT 1 FROM ${schema}.users WHERE lower(username) = lower($2)
     )`,
    ['Super Admin', SUPER_ADMIN_USERNAME, hashPassword(SUPER_ADMIN_PASSWORD)]
  );

  // Legacy demo users (no credentials - cannot log in by themselves).
  const users = [
    { name: 'Operator', role: 'operator' },
    { name: 'Supervisor', role: 'supervisor' },
    { name: 'Admin', role: 'admin' },
  ];
  for (const u of users) {
    await pool.query(
      `INSERT INTO ${schema}.users (name, role)
       SELECT $1, $2 WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.users WHERE name = $1 AND role = $2 AND username IS NULL
       )`,
      [u.name, u.role]
    );
  }
  console.log('Seed complete (default Super Admin ensured).');
}

if (require.main === module) {
  run()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}

module.exports = run;
