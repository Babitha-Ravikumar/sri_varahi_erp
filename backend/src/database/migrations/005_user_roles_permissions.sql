-- Sri Varahi ERP - user roles (adds staff) and per-user module permissions.
-- modules = NULL means "use the default module set for the user's role".

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS modules jsonb;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('operator', 'supervisor', 'staff', 'admin', 'super_admin'));

COMMIT;
