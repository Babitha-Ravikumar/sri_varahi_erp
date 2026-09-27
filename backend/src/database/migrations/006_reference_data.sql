-- ============================================================
-- REFERENCE DATA (master lists the app shows in dropdowns, chips,
-- badges and cards). The frontend reads these via GET /reference and
-- never keeps its own copy.
--   category   : role | purchase_source | payment_method | bill_status
--   code       : the value stored on business rows (users.role, ...)
--   selectable : offered for selection (e.g. roles a Super Admin may assign)
-- ============================================================
CREATE TABLE IF NOT EXISTS reference_values (
  category    text    NOT NULL,
  code        text    NOT NULL,
  label       text    NOT NULL,
  description text,
  icon        text,
  sort_order  integer NOT NULL DEFAULT 0,
  selectable  boolean NOT NULL DEFAULT true,
  active      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (category, code)
);

INSERT INTO reference_values (category, code, label, description, icon, sort_order, selectable) VALUES
  ('role', 'admin',       'Admin',       NULL, NULL, 1, true),
  ('role', 'super_admin', 'Super Admin', NULL, NULL, 2, true),
  ('role', 'staff',       'Staff',       NULL, NULL, 3, true),
  ('role', 'supervisor',  'Supervisor',  NULL, NULL, 4, false),
  ('role', 'operator',    'Operator',    NULL, NULL, 5, false),

  ('purchase_source', 'local_farmer',   'Local Farmer',   'Vehicle · farmer · quality · boxes',   '🌾', 1, true),
  ('purchase_source', 'local_trader',   'Local Trader',   'Trader · boxes · purchase rate',       '🏪', 2, true),
  ('purchase_source', 'outside_trader', 'Outside Trader', 'Supplier · vehicle · quality · boxes', '🚚', 3, true),
  ('purchase_source', 'night_arrival',  'Night Arrival',  'Night stock at a predetermined price', '🌙', 4, true),

  ('payment_method', 'cash', 'Cash', NULL, '💵', 1, true),
  ('payment_method', 'upi',  'UPI',  NULL, '📱', 2, true),
  ('payment_method', 'bank', 'Bank', NULL, '🏦', 3, true),

  ('bill_status', 'paid',      'Paid',           NULL, NULL, 1, true),
  ('bill_status', 'unpaid',    'Unpaid',         NULL, NULL, 2, true),
  ('bill_status', 'part_paid', 'Partially Paid', NULL, NULL, 3, true),
  ('bill_status', 'void',      'Void',           NULL, NULL, 4, false)
ON CONFLICT (category, code) DO NOTHING;
