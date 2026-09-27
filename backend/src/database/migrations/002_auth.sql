-- Sri Varahi ERP - Authentication & user management schema
-- Adds credential columns to users, the super_admin role,
-- and the password-reset OTP table.

BEGIN;

-- ============================================================
-- USERS: extend with authentication columns
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Usernames are unique, case-insensitive. Only meaningful when set
-- (legacy seeded users have no credentials yet).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email)) WHERE email IS NOT NULL;

-- Widen the role CHECK to include super_admin (drops whatever
-- check constraint currently guards users.role, then re-adds it).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('operator', 'supervisor', 'admin', 'super_admin'));

-- ============================================================
-- PASSWORD RESET OTP
-- One active OTP per user; hashed, expiring, single-use,
-- attempt-limited. All reset state lives in the database.
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id),
  channel     text NOT NULL CHECK (channel IN ('email', 'phone')),
  destination text NOT NULL,
  otp_hash    text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_otps_user ON password_reset_otps (user_id);
CREATE INDEX IF NOT EXISTS idx_reset_otps_created ON password_reset_otps (created_at);
CREATE TRIGGER trg_reset_otps_touch BEFORE UPDATE ON password_reset_otps
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
