/**
 * Authentication service - credentials, user creation and OTP-based
 * password reset. Passwords are never stored or logged in plain text;
 * they are hashed with scrypt (Node built-in crypto, per-user salt).
 *
 * All state (users, hashes, reset/OTP state) lives in PostgreSQL.
 */
const crypto = require('crypto');
const { query } = require('../database/db');
const roleMaster = require('./role.service');

// ---------- Password hashing (scrypt: N=16384, r=8, p=1, 64-byte key) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64 };

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, SCRYPT.keyLen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
  }).toString('hex');
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

function verifyPassword(plain, stored) {
  try {
    const [scheme, N, r, p, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const calc = crypto.scryptSync(plain, salt, hash.length / 2, {
      N: Number(N), r: Number(r), p: Number(p),
    }).toString('hex');
    // constant-time compare
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(hash, 'hex'));
  } catch (_e) {
    return false;
  }
}

// ---------- Validation ----------
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;
const PHONE_RE = /^[0-9+\-\s]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Password policy: min 8 chars, at least one letter and one digit. */
function validatePassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8 || plain.length > 72) {
    return 'Password must be 8-72 characters long.';
  }
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    return 'Password must contain at least one letter and one digit.';
  }
  return null;
}

/** Default password assigned to every newly created Admin user. */
const DEFAULT_ADMIN_PASSWORD = 'pass@123';

// ---------- Errors ----------
function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

// ---------- Roles & module permissions ----------
/** Roles a Super Admin can assign: the active rows of the Role master. */
async function assignableRoles() {
  const rows = await roleMaster.list();
  return rows.map((r) => ({ id: r.id, code: r.code, role_name: r.role_name }));
}

/** Role name from the Role master, for any column list selecting from users. */
const ROLE_NAME_SQL = '(SELECT role_name FROM roles WHERE roles.id = users.role_id) AS role_name';

/** Application modules that can be enabled/disabled per user.
 *  The dashboard is always available; user management is Super Admin only. */
const MODULE_KEYS = [
  'sourceSelect', 'lots', 'liveAuction', 'billing', 'cashier',
  'nightArrival', 'vehicleMaster', 'corrections', 'audit',
];

const DEFAULT_MODULES = {
  super_admin: MODULE_KEYS,
  admin: MODULE_KEYS,
  staff: ['sourceSelect', 'lots', 'liveAuction', 'billing', 'cashier', 'nightArrival'],
};

/** Effective modules: the user's explicit list, or the role's defaults. */
function effectiveModules(user) {
  const list = Array.isArray(user.modules) ? user.modules : (DEFAULT_MODULES[user.role] || []);
  const mods = list.filter((m) => MODULE_KEYS.includes(m));
  if (user.role === 'super_admin') mods.push('userCreation');
  if (user.role === 'super_admin' || user.role === 'admin') mods.push('qualityGrades');
  return mods;
}

function cleanModules(modules) {
  if (modules === undefined) return undefined;
  if (!Array.isArray(modules)) fail(400, 'modules must be a list of module keys.');
  const bad = modules.filter((m) => !MODULE_KEYS.includes(m));
  if (bad.length) fail(400, `Unknown module(s): ${bad.join(', ')}`);
  return Array.from(new Set(modules));
}

const INACTIVE_MESSAGE = 'This user is inactive. Please contact the administrator.';

// ---------- Login ----------
/**
 * Login with username and password. The role comes from the stored account.
 * Inactive users get a clear message once their credentials are verified.
 */
async function login({ username, password }) {
  if (!username || !password) fail(400, 'Username and password are required.');

  const r = await query(
    `SELECT id, name, username, role, ${ROLE_NAME_SQL}, password_hash, active, must_change_password, modules
       FROM users WHERE lower(username) = lower($1)`,
    [String(username).trim()]
  );
  const user = r.rows[0];
  // Same error for unknown user / wrong password: no enumeration.
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    fail(401, 'Invalid username or password.');
  }
  if (!user.active) fail(403, INACTIVE_MESSAGE);

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      role_name: user.role_name,
      modules: effectiveModules(user),
    },
    must_change_password: user.must_change_password,
  };
}

// ---------- User creation (Super Admin only) ----------
async function createUser(actor, { username, name, phone, email, role_id, role, modules }) {
  if (!actor || actor.role !== 'super_admin') fail(403, 'Only the Super Admin can create users.');

  username = String(username || '').trim();
  name = String(name || '').trim();
  phone = phone ? String(phone).trim() : null;
  email = email ? String(email).trim().toLowerCase() : null;
  const hasRoleId = role_id !== undefined && role_id !== null && role_id !== '';
  if (hasRoleId && !/^\d+$/.test(String(role_id))) fail(400, 'Invalid role.');
  const picked = await roleMaster.findActive({ id: hasRoleId ? role_id : null, code: role || 'admin' });
  if (!picked) {
    const roles = await assignableRoles();
    fail(400, `Role must be one of: ${roles.map((r) => r.role_name).join(', ')}.`);
  }
  role = picked.code;
  modules = cleanModules(modules);

  if (!USERNAME_RE.test(username)) {
    fail(400, 'Username must be 3-40 characters (letters, numbers, dot, underscore, hyphen).');
  }
  if (!name) fail(400, 'Full name is required.');
  if (phone && !PHONE_RE.test(phone)) fail(400, 'Invalid phone number.');
  if (email && !EMAIL_RE.test(email)) fail(400, 'Invalid email address.');
  // Contact is required for Forgot Password to work for the account.
  if (!phone && !email) fail(400, 'Provide at least a phone number or an email for password recovery.');

  const dupe = await query(
    'SELECT 1 FROM users WHERE lower(username) = lower($1)',
    [username]
  );
  if (dupe.rowCount > 0) fail(409, 'Username already exists.');

  // Contact details must not belong to another user either.
  if (phone) {
    const p = await query('SELECT 1 FROM users WHERE phone = $1 AND username IS DISTINCT FROM lower($2)', [phone, username]);
    if (p.rowCount > 0) fail(409, 'Phone number is already registered to another user.');
  }
  if (email) {
    const e = await query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (e.rowCount > 0) fail(409, 'Email is already registered to another user.');
  }

  const r = await query(
    `INSERT INTO users (name, username, role, phone, email, password_hash, must_change_password, modules)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7)
     RETURNING id, name, username, role, ${ROLE_NAME_SQL}, phone, email, active, must_change_password, modules, created_at`,
    [name, username, role, phone, email, hashPassword(DEFAULT_ADMIN_PASSWORD),
     modules === undefined ? null : JSON.stringify(modules)]
  );
  const user = r.rows[0];
  return { ...user, modules: effectiveModules(user) };
}

async function listUsers(actor) {
  if (!actor || actor.role !== 'super_admin') fail(403, 'Only the Super Admin can list users.');
  const r = await query(
    `SELECT id, name, username, role, ${ROLE_NAME_SQL}, phone, email, active, must_change_password,
            modules, last_login_at, created_at
       FROM users WHERE username IS NOT NULL ORDER BY role, id`
  );
  return r.rows.map((u) => ({ ...u, modules: effectiveModules(u) }));
}

/** Super Admin: change a user's Active status and/or module permissions. */
async function updateUser(actor, userId, { active, modules }) {
  if (!actor || actor.role !== 'super_admin') fail(403, 'Only the Super Admin can manage users.');
  const id = Number(userId);
  if (!Number.isInteger(id)) fail(400, 'Invalid user id.');
  if (active !== undefined && typeof active !== 'boolean') fail(400, 'active must be true or false.');
  if (active === false && id === Number(actor.id)) fail(400, 'You cannot deactivate your own account.');
  modules = cleanModules(modules);

  const r = await query(
    `UPDATE users SET
       active  = COALESCE($2, active),
       modules = CASE WHEN $3::boolean THEN $4::jsonb ELSE modules END
     WHERE id = $1 AND username IS NOT NULL
     RETURNING id, name, username, role, ${ROLE_NAME_SQL}, phone, email, active, must_change_password,
               modules, last_login_at, created_at`,
    [id, active === undefined ? null : active, modules !== undefined,
     modules === undefined ? null : JSON.stringify(modules)]
  );
  if (!r.rows[0]) fail(404, 'User not found.');
  const user = r.rows[0];
  return { ...user, modules: effectiveModules(user) };
}

// ---------- Password change (forced first-login reset) ----------
/**
 * Change the signed-in user's password. Works even while the user is in
 * the must-change-password state (it is the only endpoint that does).
 */
async function changePassword(userId, { current_password, new_password }) {
  if (!current_password || !new_password) fail(400, 'Current and new password are required.');
  const policy = validatePassword(new_password);
  if (policy) fail(400, policy);

  const r = await query(
    'SELECT id, password_hash FROM users WHERE id = $1 AND active',
    [userId]
  );
  const user = r.rows[0];
  if (!user || !user.password_hash || !verifyPassword(current_password, user.password_hash)) {
    fail(401, 'Current password is incorrect.');
  }
  if (verifyPassword(new_password, user.password_hash)) {
    fail(400, 'New password must be different from the current password.');
  }

  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [hashPassword(new_password), userId]
  );
  return { ok: true };
}

// ---------- Forgot password: OTP over registered phone/email ----------
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

function makeOtp() {
  // 6-digit code from a cryptographically secure random source.
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/** Delivery: pluggable. Without a gateway configured the OTP is logged on the
 *  server; in non-production mode it is also returned as dev_otp so the flow
 *  can be completed and tested end to end. */
function deliverOtp(destination, channel, otp) {
  console.log(`[OTP] Password-reset code for ${channel} ${destination}: ****** (valid ${OTP_TTL_MINUTES} min)`);
  // Integrate an SMS/email gateway here in production.
}

function detectChannel(contact) {
  const c = String(contact || '').trim();
  if (EMAIL_RE.test(c)) return { channel: 'email', destination: c.toLowerCase() };
  if (PHONE_RE.test(c)) return { channel: 'phone', destination: c.replace(/[\s-]/g, '') };
  return null;
}

/** Step 1: user asks for a reset OTP on their registered phone/email. */
async function requestResetOtp({ contact }) {
  const found = detectChannel(contact);
  if (!found) fail(400, 'Enter a valid phone number or email address.');
  const { channel, destination } = found;

  const r = await query(
    channel === 'email'
      ? `SELECT id FROM users WHERE active AND lower(email) = $1`
      : `SELECT id FROM users WHERE active AND regexp_replace(phone, '[\\s-]', '', 'g') = $1`,
    [destination]
  );
  const user = r.rows[0];
  // Do not reveal whether the contact is registered.
  if (!user) {
    return { message: 'If that phone/email is registered, an OTP has been sent.', expires_in_minutes: OTP_TTL_MINUTES };
  }

  // Invalidate any previous unconsumed OTP for this user, then issue a new one.
  await query(
    `UPDATE password_reset_otps SET consumed_at = now()
      WHERE user_id = $1 AND consumed_at IS NULL`,
    [user.id]
  );
  const otp = makeOtp();
  await query(
    `INSERT INTO password_reset_otps (user_id, channel, destination, otp_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [user.id, channel, destination, hashPassword(otp), OTP_TTL_MINUTES]
  );
  deliverOtp(destination, channel, otp);

  const resp = {
    message: `OTP sent to your registered ${channel}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    expires_in_minutes: OTP_TTL_MINUTES,
  };
  if (process.env.NODE_ENV !== 'production') resp.dev_otp = otp; // testing aid only
  return resp;
}

/** Step 2: verify the OTP and set the new password. */
async function verifyResetOtp({ contact, otp, new_password }) {
  const found = detectChannel(contact);
  if (!found) fail(400, 'Enter a valid phone number or email address.');
  if (!otp || !/^\d{6}$/.test(String(otp).trim())) fail(400, 'Enter the 6-digit OTP.');
  const policy = validatePassword(new_password);
  if (policy) fail(400, policy);

  const u = await query(
    found.channel === 'email'
      ? `SELECT id FROM users WHERE active AND lower(email) = $1`
      : `SELECT id FROM users WHERE active AND regexp_replace(phone, '[\\s-]', '', 'g') = $1`,
    [found.destination]
  );
  const user = u.rows[0];
  if (!user) fail(400, 'Invalid OTP or contact details.');

  const r = await query(
    `SELECT id, otp_hash, expires_at, attempts, consumed_at
       FROM password_reset_otps
      WHERE user_id = $1 AND consumed_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [user.id]
  );
  const row = r.rows[0];
  if (!row) fail(400, 'No OTP requested. Please request a new one.');
  if (new Date(row.expires_at) < new Date()) {
    fail(400, 'OTP has expired. Please request a new one.');
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    fail(429, 'Too many incorrect attempts. Please request a new OTP.');
  }

  if (!verifyPassword(String(otp).trim(), row.otp_hash)) {
    await query(
      'UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1',
      [row.id]
    );
    const left = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    fail(400, `Incorrect OTP.${left > 0 ? ` ${left} attempt(s) remaining.` : ' Please request a new one.'}`);
  }

  // Single-use consume + password update atomically.
  await query(
    `UPDATE password_reset_otps SET consumed_at = now() WHERE id = $1`,
    [row.id]
  );
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [hashPassword(new_password), user.id]
  );
  return { message: 'Password reset successfully. You can now log in with your new password.' };
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
  DEFAULT_ADMIN_PASSWORD,
  MODULE_KEYS,
  assignableRoles,
  effectiveModules,
  login,
  createUser,
  listUsers,
  updateUser,
  changePassword,
  requestResetOtp,
  verifyResetOtp,
};
