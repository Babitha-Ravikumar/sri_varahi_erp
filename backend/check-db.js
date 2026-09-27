const { Pool } = require("pg");
const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: "postgres",
});
(async () => {
  try {
    const r = await pool.query(
      "SELECT current_database() AS db, current_user AS usr",
    );
    console.log("connected:", r.rows[0]);
    const exists = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = 'dev'`,
    );
    console.log('db "dev" exists:', exists.rowCount > 0);
    await pool.end();
  } catch (e) {
    console.error("ERR:", e.message);
    process.exit(1);
  }
})();
