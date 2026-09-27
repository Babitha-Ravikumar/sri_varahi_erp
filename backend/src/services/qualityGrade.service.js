const { query, withTransaction } = require('../database/db');

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

const STATUSES = ['active', 'inactive'];

/** Quality grades; active only unless `all` is set (the management screen). */
async function list({ all } = {}) {
  const r = await query(
    `SELECT id, grade_name, status, created_at, updated_at
       FROM quality_grades
      WHERE ($1 OR status = 'active')
      ORDER BY id`,
    [all === true || all === 'true']
  );
  return r.rows;
}

function cleanName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n) fail(400, 'Grade name is required.');
  if (n.length > 60) fail(400, 'Grade name must be 60 characters or fewer.');
  return n;
}

async function create({ grade_name, status }) {
  const name = cleanName(grade_name);
  const st = status || 'active';
  if (!STATUSES.includes(st)) fail(400, 'Status must be active or inactive.');
  try {
    const r = await query(
      `INSERT INTO quality_grades (grade_name, status) VALUES ($1, $2)
       RETURNING id, grade_name, status, created_at, updated_at`,
      [name, st]
    );
    return r.rows[0];
  } catch (e) {
    if (e.code === '23505') fail(409, `Grade "${name}" already exists.`);
    throw e;
  }
}

/** Rename and/or activate/deactivate; a rename is copied to the lots/inwards that use the grade. */
async function update(id, { grade_name, status }) {
  const name = grade_name === undefined ? undefined : cleanName(grade_name);
  if (status !== undefined && !STATUSES.includes(status)) fail(400, 'Status must be active or inactive.');
  try {
    return await withTransaction(async (client) => {
      const r = await client.query(
        `UPDATE quality_grades
            SET grade_name = COALESCE($2, grade_name),
                status     = COALESCE($3, status)
          WHERE id = $1
          RETURNING id, grade_name, status, created_at, updated_at`,
        [id, name ?? null, status ?? null]
      );
      const grade = r.rows[0];
      if (!grade) fail(404, 'Quality grade not found.');
      if (name !== undefined) {
        await client.query('UPDATE inwards SET quality = $2 WHERE quality_grade_id = $1', [id, grade.grade_name]);
        await client.query('UPDATE lots SET quality = $2 WHERE quality_grade_id = $1', [id, grade.grade_name]);
      }
      return grade;
    });
  } catch (e) {
    if (e.code === '23505') fail(409, `Grade "${name}" already exists.`);
    throw e;
  }
}

module.exports = { list, create, update };
