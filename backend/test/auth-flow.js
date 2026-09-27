/**
 * End-to-end auth flow test (run against a freshly started backend):
 * 1. Super Admin login
 * 2. Create Admin user
 * 3. Admin first login (must_change_password = true, ERP blocked)
 * 4. Forced reset (wrong current pw rejected, weak new pw rejected, then valid)
 * 5. Admin normal login + ERP access
 * 6. Forgot password: OTP request, wrong OTP, expiry-safe checks, verify + new password
 * 7. Login with the new password
 * Also verifies passwords are hashed in the DB, never plain text.
 */
let BASE = "http://localhost:3000/api";
const assert = require("assert");

// Unique per run so the test can be re-run against a live server.
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ADMIN_USERNAME = "test.admin." + RUN;
const ADMIN_EMAIL = ADMIN_USERNAME + "@example.com";
const ADMIN_PHONE =
  "98" + String(70000000 + Math.floor(Math.random() * 9999999)).slice(0, 8);

let passed = 0;
function ok(label, cond) {
  assert(cond, "FAILED: " + label);
  passed++;
  console.log("  ✓ " + label);
}

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  console.log("1) Super Admin login");
  let r = await call("POST", "/auth/login", {
    role: "super_admin",
    username: "superadmin",
    password: "SuperAdmin@123",
  });
  ok(
    "superadmin can log in",
    r.status === 200 && r.data.user.role === "super_admin",
  );
  const saId = r.data.user.id;
  const SA = { "X-User-Id": String(saId) };
  ok("no forced reset for super admin", r.data.must_change_password === false);

  console.log("2) Super Admin creates an Admin user");
  r = await call(
    "POST",
    "/auth/users",
    {
      username: ADMIN_USERNAME,
      name: "Ravi Kumar",
      phone: ADMIN_PHONE,
      email: ADMIN_EMAIL,
    },
    SA,
  );
  ok(
    "admin created with default-password flag",
    r.status === 201 && r.data.must_change_password === true,
  );
  const adminId = r.data.id;

  r = await call(
    "POST",
    "/auth/users",
    { username: ADMIN_USERNAME, name: "Dup", phone: "9999999999" },
    SA,
  );
  ok("duplicate username rejected (409)", r.status === 409);
  r = await call(
    "POST",
    "/auth/users",
    { username: "x", name: "Bad", phone: "911" },
    SA,
  );
  ok("invalid username rejected", r.status === 400);
  r = await call(
    "POST",
    "/auth/users",
    { username: "nocontact", name: "No Contact" },
    SA,
  );
  ok("user without phone/email rejected", r.status === 400);

  console.log("3) Admin first login -> forced reset");
  r = await call("POST", "/auth/login", {
    role: "admin",
    username: ADMIN_USERNAME,
    password: "pass@123",
  });
  ok("admin logs in with default password", r.status === 200);
  ok(
    "must_change_password flag returned",
    r.data.must_change_password === true,
  );
  const AD = { "X-User-Id": String(r.data.user.id) };

  r = await call("GET", "/inwards/consolidated", undefined, AD);
  ok("ERP access blocked until reset (401)", r.status === 401);

  console.log("4) Forced password reset");
  r = await call(
    "POST",
    "/auth/change-password",
    { current_password: "wrong", new_password: "NewPass@123" },
    AD,
  );
  ok("wrong current password rejected", r.status === 401);
  r = await call(
    "POST",
    "/auth/change-password",
    { current_password: "pass@123", new_password: "short" },
    AD,
  );
  ok("weak new password rejected", r.status === 400);
  r = await call(
    "POST",
    "/auth/change-password",
    { current_password: "pass@123", new_password: "pass@123" },
    AD,
  );
  ok("reusing same password rejected", r.status === 400);
  r = await call(
    "POST",
    "/auth/change-password",
    { current_password: "pass@123", new_password: "Ravi@2024" },
    AD,
  );
  ok("valid reset accepted", r.status === 200);

  console.log("5) Admin normal login + ERP access");
  r = await call("POST", "/auth/login", {
    role: "admin",
    username: ADMIN_USERNAME,
    password: "pass@123",
  });
  ok("old default password no longer works", r.status === 401);
  r = await call("POST", "/auth/login", {
    role: "admin",
    username: ADMIN_USERNAME,
    password: "Ravi@2024",
  });
  ok(
    "admin logs in with new password",
    r.status === 200 && r.data.must_change_password === false,
  );
  r = await call("GET", "/inwards/consolidated", undefined, {
    "X-User-Id": String(r.data.user.id),
  });
  ok("ERP access granted after reset", r.status === 200);
  r = await call("POST", "/auth/login", {
    username: ADMIN_USERNAME,
    password: "Ravi@2024",
  });
  ok(
    "role is taken from the account (no role on login)",
    r.status === 200 && r.data.user.role === "admin" && Array.isArray(r.data.user.modules),
  );

  console.log("5b) Inactive users cannot log in");
  r = await call("PATCH", `/auth/users/${adminId}`, { active: false }, SA);
  ok("super admin deactivates user", r.status === 200 && r.data.active === false);
  r = await call("POST", "/auth/login", {
    username: ADMIN_USERNAME,
    password: "Ravi@2024",
  });
  ok(
    "inactive user blocked with clear message",
    r.status === 403 && r.data.error === "This user is inactive. Please contact the administrator.",
  );
  r = await call("PATCH", `/auth/users/${adminId}`, { active: true, modules: ["lots", "billing"] }, SA);
  ok(
    "super admin reactivates user and sets modules",
    r.status === 200 && r.data.active === true && r.data.modules.join(",") === "lots,billing",
  );
  r = await call("POST", "/auth/login", {
    username: ADMIN_USERNAME,
    password: "Ravi@2024",
  });
  ok(
    "reactivated user logs in with only enabled modules",
    r.status === 200 && r.data.user.modules.join(",") === "lots,billing",
  );

  console.log("6) Forgot password with OTP");
  r = await call("POST", "/auth/forgot-password/otp", {
    contact: "not-a-contact",
  });
  ok("invalid contact rejected", r.status === 400);
  r = await call("POST", "/auth/forgot-password/otp", {
    contact: "unknown@example.com",
  });
  ok(
    "unregistered contact gives generic answer",
    r.status === 200 && !r.data.dev_otp,
  );
  r = await call("POST", "/auth/forgot-password/otp", { contact: ADMIN_EMAIL });
  ok(
    "OTP issued for registered email",
    r.status === 200 && /^\d{6}$/.test(r.data.dev_otp),
  );
  const otp1 = r.data.dev_otp;

  r = await call("POST", "/auth/forgot-password/verify", {
    contact: ADMIN_EMAIL,
    otp: "000000",
    new_password: "Hacked@123",
  });
  ok("wrong OTP rejected", r.status === 400);
  r = await call("POST", "/auth/forgot-password/verify", {
    contact: ADMIN_EMAIL,
    otp: otp1,
    new_password: "Hacked@123",
  });
  ok("correct OTP resets password", r.status === 200);
  r = await call("POST", "/auth/forgot-password/verify", {
    contact: ADMIN_EMAIL,
    otp: otp1,
    new_password: "Again@123",
  });
  ok("OTP is single-use", r.status === 400);

  // Phone-based reset too
  r = await call("POST", "/auth/forgot-password/otp", { contact: ADMIN_PHONE });
  ok(
    "OTP issued for registered phone",
    r.status === 200 && /^\d{6}$/.test(r.data.dev_otp),
  );
  r = await call("POST", "/auth/forgot-password/verify", {
    contact: ADMIN_PHONE,
    otp: r.data.dev_otp,
    new_password: "Ravi@2025",
  });
  ok("phone OTP reset works", r.status === 200);

  console.log("7) Login with the final new password");
  r = await call("POST", "/auth/login", {
    role: "admin",
    username: ADMIN_USERNAME,
    password: "Ravi@2025",
  });
  ok("admin logs in with OTP-reset password", r.status === 200);

  console.log("8) Passwords stored hashed in PostgreSQL");
  const { Pool } = require("pg");
  const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "sri_varahi_erp",
    user: "postgres",
    password: "admin@123",
    options: "-c search_path=public",
  });
  const hashes = (
    await pool.query(
      "SELECT string_agg(password_hash, '|') AS h FROM users WHERE username IN ('superadmin',$1)",
      [ADMIN_USERNAME],
    )
  ).rows[0].h;
  ok(
    "hashes use scrypt scheme",
    hashes.split("|").every((h) => h.startsWith("scrypt$")),
  );
  const plain = (
    await pool.query(
      `SELECT count(*)::int AS n FROM users
      WHERE password_hash LIKE '%pass@123%'
         OR password_hash LIKE '%Ravi@2025%'
         OR password_hash LIKE '%SuperAdmin%'`,
    )
  ).rows[0].n;
  ok("no plain-text passwords in DB", plain === 0);
  const otpHash = (
    await pool.query(
      "SELECT count(*)::int AS n FROM password_reset_otps WHERE otp_hash LIKE 'scrypt$%'",
    )
  ).rows[0].n;
  ok("OTP codes stored hashed", otpHash > 0);
  await pool.end();

  console.log(`\nALL ${passed} CHECKS PASSED`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
