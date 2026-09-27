-- ============================================================
-- ROLE MASTER - the single source of truth for user roles.
-- `code` is the fixed internal key that permission checks use
-- (requireRole('super_admin'), default module sets); `role_name`
-- is what the app displays and may be renamed freely.
-- users.role keeps the code; users.role_id links to the master and
-- is kept in step by trigger.
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          bigserial PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  role_name   text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_name ON roles (lower(role_name));
CREATE TRIGGER trg_roles_touch BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO roles (code, role_name) VALUES
  ('super_admin', 'Super Admin'),
  ('admin',       'Admin'),
  ('staff',       'Staff')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id bigint REFERENCES roles(id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);

UPDATE users u SET role_id = r.id FROM roles r WHERE r.code = u.role AND u.role_id IS DISTINCT FROM r.id;

CREATE OR REPLACE FUNCTION users_sync_role_id() RETURNS trigger AS $$
BEGIN
  NEW.role_id := (SELECT id FROM roles WHERE code = NEW.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_role_id BEFORE INSERT OR UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION users_sync_role_id();

-- Roles are validated against the master in auth.service, not a fixed list.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Roles no longer live in the generic reference list.
DELETE FROM reference_values WHERE category = 'role';
