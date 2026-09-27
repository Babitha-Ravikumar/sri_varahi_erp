/**
 * Minimal migration runner: applies .sql files from migrations/ in order.
 * Applied files are tracked in sri_varahi_erp.schema_migrations.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { pool } = require('./db');

async function run() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${config.db.schema}`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${config.db.schema}.schema_migrations (
       file text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );

  for (const file of files) {
    const applied = await pool.query(
      `SELECT 1 FROM ${config.db.schema}.schema_migrations WHERE file = $1`,
      [file]
    );
    if (applied.rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(
        `INSERT INTO ${config.db.schema}.schema_migrations (file) VALUES ($1)`,
        [file]
      );
      await pool.query('COMMIT');
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
  console.log('Migrations complete.');
}

if (require.main === module) {
  run()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = run;
