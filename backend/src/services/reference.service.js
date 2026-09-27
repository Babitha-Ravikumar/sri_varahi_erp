const { query } = require('../database/db');

/** Active reference values grouped by category: { role: [...], purchase_source: [...], ... } */
async function all() {
  const r = await query(
    `SELECT category, code, label, description, icon, selectable
       FROM reference_values WHERE active ORDER BY category, sort_order, label`
  );
  const out = {};
  for (const row of r.rows) {
    (out[row.category] = out[row.category] || []).push({
      code: row.code, label: row.label, description: row.description,
      icon: row.icon, selectable: row.selectable,
    });
  }
  return out;
}

async function list(category, { selectableOnly = false } = {}) {
  const r = await query(
    `SELECT code, label, description, icon, selectable
       FROM reference_values
      WHERE active AND category = $1 AND (NOT $2 OR selectable)
      ORDER BY sort_order, label`,
    [category, selectableOnly]
  );
  return r.rows;
}

module.exports = { all, list };
