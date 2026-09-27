const { Pool } = require('pg');
const config = require('../config/env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  options: `-c search_path=${config.db.schema}`,
});

pool.on('error', (err) => {
  // Never log credentials - only the error message
  console.error('Unexpected database pool error:', err.message);
});

/**
 * Run a query. Accepts (sql, params) or a client for transactions.
 */
function query(sql, params) {
  return pool.query(sql, params);
}

/**
 * Run `fn` inside a transaction with BEGIN/COMMIT/ROLLBACK.
 * fn receives a bound client.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
