/**
 * Simple authorization middleware.
 * The React Native app sends X-User-Id (the logged-in staff user).
 * Roles: operator (entry), supervisor/admin (post-auction corrections),
 * super_admin (user management).
 *
 * Users flagged must_change_password (newly created admins on first
 * login) are NOT attached: every ERP endpoint is blocked until they
 * complete the forced password reset via /auth/change-password.
 */
const { query } = require('../database/db');

async function attachUser(req, _res, next) {
  // X-User-Id header (app) or ?user_id= query (direct PDF download links,
  // which browsers cannot attach headers to). Same validation either way.
  const userId = req.header('X-User-Id') || req.query.user_id;
  if (userId) {
    const r = await query(
      `SELECT id, name, role FROM users
        WHERE id = $1 AND active AND NOT must_change_password`,
      [userId]
    );
    if (r.rows[0]) req.user = r.rows[0];
  }
  next();
}

function requireUser(req, _res, next) {
  if (!req.user) {
    const err = new Error('Unauthorized: provide a valid X-User-Id header');
    err.status = 401;
    return next(err);
  }
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      const err = new Error('Unauthorized: provide a valid X-User-Id header');
      err.status = 401;
      return next(err);
    }
    if (!roles.includes(req.user.role)) {
      const err = new Error(`Forbidden: requires role ${roles.join(' or ')}`);
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { attachUser, requireUser, requireRole };
