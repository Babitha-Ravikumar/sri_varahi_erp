const { query } = require('../database/db');

/** Audit trail query - by entity, entity_id, or recent. */
async function listAudit({ entity, entity_id, limit } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (entity) { params.push(entity); where += ` AND a.entity = $${params.length}`; }
  if (entity_id) { params.push(entity_id); where += ` AND a.entity_id = $${params.length}`; }
  params.push(Math.min(Number(limit) || 100, 500));
  const r = await query(
    `SELECT a.*, u.name AS changed_by_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.changed_by
     ${where} ORDER BY a.id DESC LIMIT $${params.length}`,
    params
  );
  return r.rows;
}

module.exports = { listAudit };
