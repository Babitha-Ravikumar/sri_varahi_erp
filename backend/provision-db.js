const { Pool } = require("pg");
const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "postgres",
});
(async () => {
  await pool.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN
      CREATE ROLE admin LOGIN PASSWORD '123';
    END IF;
  END $$;`);
  const db = await pool.query(
    `SELECT 1 FROM pg_database WHERE datname = 'dev'`,
  );
  if (db.rowCount === 0) {
    await pool.query(`CREATE DATABASE dev OWNER admin`);
    console.log("created database dev");
  }
  console.log("provisioned");
  await pool.end();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
