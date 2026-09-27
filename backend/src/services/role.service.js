/** Role master (roles table) - the single source of truth for user roles. */
const { query } = require('../database/db');

/** Roles ordered by id; active only unless `all` is set. */
async function list({ all = false } = {}) {
  const r = await query(
    `SELECT id, code, role_name, status, created_at, updated_at
       FROM roles WHERE $1 OR status = 'active' ORDER BY id`,
    [all]
  );
  return r.rows;
}

/** An active role by id (or by code when no id is given); null if none. */
async function findActive({ id, code }) {
  const r = await query(
    `SELECT id, code, role_name FROM roles
      WHERE status = 'active' AND (CASE WHEN $1::bigint IS NOT NULL THEN id = $1::bigint ELSE code = $2 END)`,
    [id == null || id === '' ? null : Number(id), code || null]
  );
  return r.rows[0] || null;
}

module.exports = { list, findActive };
