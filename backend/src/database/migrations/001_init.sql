-- Sri Varahi ERP - Module 1 schema
-- Purchase Source -> Inward -> Lot -> Lot Card -> Pre-Auction -> Live Auction
--   -> Customer Allocation -> Billing -> Cashier (with Audit Trail)

BEGIN;

-- Schema and search_path are set by the migration runner (db.js pool sets
-- search_path from DB_SCHEMA), so objects below are created unqualified.

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS (authorization for post-auction corrections)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  role        text NOT NULL CHECK (role IN ('operator', 'supervisor', 'admin')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- VEHICLE MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id            bigserial PRIMARY KEY,
  vehicle_number text NOT NULL UNIQUE,
  vehicle_name  text,
  driver_name   text,
  driver_phone  text,
  is_regular    boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_vehicles_touch BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- PARTY (Farmer / Local Trader / Outside Trader supplier)
-- ============================================================
CREATE TABLE IF NOT EXISTS parties (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  party_type  text NOT NULL CHECK (party_type IN ('farmer', 'local_trader', 'outside_trader')),
  phone       text,
  address     text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties (lower(name));
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties (party_type);
CREATE TRIGGER trg_parties_touch BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- CUSTOMER
-- details_complete = false when quickly created during auction
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id               bigserial PRIMARY KEY,
  name             text NOT NULL,
  phone            text,
  address          text,
  details_complete boolean NOT NULL DEFAULT false,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (lower(name));
CREATE TRIGGER trg_customers_touch BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- INWARD (one row per arrival; purchase_source drives the flow)
-- ============================================================
CREATE TABLE IF NOT EXISTS inwards (
  id              bigserial PRIMARY KEY,
  purchase_source text NOT NULL CHECK (purchase_source IN
                    ('local_farmer', 'local_trader', 'outside_trader', 'night_arrival')),
  inward_date     date NOT NULL DEFAULT current_date,
  vehicle_id      bigint REFERENCES vehicles(id),
  -- per-arrival capture (outside-trader arrivals change daily)
  vehicle_number  text,
  vehicle_name    text,
  driver_name     text,
  driver_phone    text,
  party_id        bigint REFERENCES parties(id),
  quality         text,
  quantity        numeric(12,2) NOT NULL CHECK (quantity > 0),
  purchase_rate   numeric(12,2),          -- local trader / final purchase rate
  -- night arrival only
  selling_price   numeric(12,2),          -- predetermined selling price
  final_rate      numeric(12,2),          -- morning final purchase rate
  trade_margin    numeric(14,2),          -- computed when final rate is fixed
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes           text,
  created_by      bigint REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inwards_date ON inwards (inward_date);
CREATE INDEX IF NOT EXISTS idx_inwards_source ON inwards (purchase_source);
CREATE INDEX IF NOT EXISTS idx_inwards_vehicle ON inwards (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inwards_party ON inwards (party_id);
CREATE TRIGGER trg_inwards_touch BEFORE UPDATE ON inwards
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- LOT (physical operational reference, auto-generated)
-- remaining_quantity is a generated column -> can never drift.
-- CHECKs prevent negative quantities / over-allocation at the DB level.
-- ============================================================
CREATE TABLE IF NOT EXISTS lots (
  id                  bigserial PRIMARY KEY,
  lot_number          text NOT NULL UNIQUE,
  inward_id           bigint NOT NULL UNIQUE REFERENCES inwards(id),
  lot_date            date NOT NULL DEFAULT current_date,
  vehicle_id          bigint REFERENCES vehicles(id),
  party_id            bigint REFERENCES parties(id),
  quality             text,
  total_quantity      numeric(12,2) NOT NULL CHECK (total_quantity > 0),
  pre_auction_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (pre_auction_quantity >= 0),
  allocated_quantity  numeric(12,2) NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
  remaining_quantity  numeric(12,2) GENERATED ALWAYS AS
                        (total_quantity - pre_auction_quantity - allocated_quantity) STORED,
  status              text NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'pre_auctioned', 'in_auction', 'allocated', 'closed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_lot_split CHECK (pre_auction_quantity + allocated_quantity <= total_quantity),
  CONSTRAINT chk_lot_remaining CHECK (total_quantity - pre_auction_quantity - allocated_quantity >= 0)
);
CREATE INDEX IF NOT EXISTS idx_lots_date ON lots (lot_date);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots (status);
CREATE INDEX IF NOT EXISTS idx_lots_vehicle ON lots (vehicle_id);
CREATE TRIGGER trg_lots_touch BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- LOT CARD (physical identification used during auction)
-- ============================================================
CREATE TABLE IF NOT EXISTS lot_cards (
  id         bigserial PRIMARY KEY,
  lot_id     bigint NOT NULL UNIQUE REFERENCES lots(id),
  card_code  text NOT NULL UNIQUE,
  printed    boolean NOT NULL DEFAULT false,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_lot_cards_touch BEFORE UPDATE ON lot_cards
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- PRE-AUCTION SALE (also used for night-arrival customer sales
-- at the predetermined selling price)
-- ============================================================
CREATE TABLE IF NOT EXISTS pre_auction_sales (
  id          bigserial PRIMARY KEY,
  lot_id      bigint NOT NULL REFERENCES lots(id),
  customer_id bigint NOT NULL REFERENCES customers(id),
  quantity    numeric(12,2) NOT NULL CHECK (quantity > 0),
  rate        numeric(12,2) NOT NULL CHECK (rate >= 0),
  sold_at     date NOT NULL DEFAULT current_date,
  created_by  bigint REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pre_auction_lot ON pre_auction_sales (lot_id);
CREATE INDEX IF NOT EXISTS idx_pre_auction_customer ON pre_auction_sales (customer_id);
CREATE TRIGGER trg_pre_auction_touch BEFORE UPDATE ON pre_auction_sales
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- AUCTION (live auction session for a lot)
-- ============================================================
CREATE TABLE IF NOT EXISTS auctions (
  id         bigserial PRIMARY KEY,
  lot_id     bigint NOT NULL UNIQUE REFERENCES lots(id),
  status     text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'closed')),
  opened_at  timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz,
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auctions_lot ON auctions (lot_id);
CREATE TRIGGER trg_auctions_touch BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- AUCTION ALLOCATION (customer <- quantity @ rate)
-- ============================================================
CREATE TABLE IF NOT EXISTS allocations (
  id          bigserial PRIMARY KEY,
  auction_id  bigint NOT NULL REFERENCES auctions(id),
  lot_id      bigint NOT NULL REFERENCES lots(id),
  customer_id bigint NOT NULL REFERENCES customers(id),
  quantity    numeric(12,2) NOT NULL CHECK (quantity > 0),
  rate        numeric(12,2) NOT NULL CHECK (rate >= 0),
  status      text NOT NULL DEFAULT 'allocated'
                CHECK (status IN ('allocated', 'billed', 'paid', 'cancelled')),
  created_by  bigint REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocations_auction ON allocations (auction_id);
CREATE INDEX IF NOT EXISTS idx_allocations_lot ON allocations (lot_id);
CREATE INDEX IF NOT EXISTS idx_allocations_customer ON allocations (customer_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations (status);
CREATE TRIGGER trg_allocations_touch BEFORE UPDATE ON allocations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- BILLING (one bill per customer per auction)
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
  id          bigserial PRIMARY KEY,
  bill_number text NOT NULL UNIQUE,
  auction_id  bigint NOT NULL REFERENCES auctions(id),
  lot_id      bigint NOT NULL REFERENCES lots(id),
  customer_id bigint NOT NULL REFERENCES customers(id),
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount  numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status      text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'part_paid', 'paid', 'void')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bills_auction ON bills (auction_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills (customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (status);
CREATE TRIGGER trg_bills_touch BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS bill_items (
  id           bigserial PRIMARY KEY,
  bill_id      bigint NOT NULL REFERENCES bills(id),
  allocation_id bigint NOT NULL REFERENCES allocations(id),
  quantity     numeric(12,2) NOT NULL,
  rate         numeric(12,2) NOT NULL,
  amount       numeric(14,2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_allocation ON bill_items (allocation_id);
CREATE TRIGGER trg_bill_items_touch BEFORE UPDATE ON bill_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- CASHIER (payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id          bigserial PRIMARY KEY,
  bill_id     bigint NOT NULL REFERENCES bills(id),
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  method      text NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'upi', 'bank')),
  received_by bigint REFERENCES users(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments (bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_at ON payments (received_at);

-- ============================================================
-- AUDIT TRAIL (every controlled correction)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  entity     text NOT NULL,
  entity_id  bigint NOT NULL,
  action     text NOT NULL,
  old_data   jsonb,
  new_data   jsonb,
  reason     text,
  changed_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at);

COMMIT;
