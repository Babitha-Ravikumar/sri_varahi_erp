/** Reset Module 1 data: drop schema and re-apply migrations + seed. */
const { pool } = require('../src/database/db');
const config = require('../src/config/env');
const migrate = require('../src/database/migrate');
const seed = require('../src/database/seed');

(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${config.db.schema} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${config.db.schema}.schema_migrations`);
  console.log('schema dropped');
  await migrate();
  await seed();
  await pool.end();
  console.log('reset complete');
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
