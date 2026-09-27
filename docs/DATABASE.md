# Database Design — Module 1

PostgreSQL, schema `sri_varahi_erp` (see `backend/src/database/migrations/001_init.sql`).

## Entity relationships

```
vehicles (Vehicle Master)
    ↑ vehicle_id (regular vehicles)
parties (farmers / local traders / outside traders)
    ↑ party_id
inwards ──1:1──► lots ──1:1──► lot_cards
  ▲                │
  │ night arrival: same inward,   ├──1:N──► pre_auction_sales ──N:1──► customers
  │ final_rate + trade_margin     └──1:1──► auctions ──1:N──► allocations ──N:1──► customers
                                                          │ 1:N (per bill, via bill_items)
                                                          ▼
                                                     bills ──1:N──► bill_items
                                                        │ 1:N
                                                        ▼
                                                     payments (cashier)
audit_log (standalone: entity/entity_id + old/new JSON + reason + user)
users (operator / supervisor / admin — authorization)
```

- **One inward = one lot = one lot card** (UNIQUE FKs enforce 1:1). Night arrival keeps
  this identity across the night; the morning final rate updates the *same* row — no duplicate.
- **Allocations** always reference both `auction_id` and `lot_id` (stock identity preserved
  end-to-end: pre-auction, auction, bill items, payments all link back to the lot).

## Quantity safety (transaction-safe)

`lots` carries three stored quantities plus a **generated column**:

```sql
remaining_quantity numeric GENERATED ALWAYS AS
  (total_quantity - pre_auction_quantity - allocated_quantity) STORED
```

and two CHECK constraints:

```sql
CONSTRAINT chk_lot_split     CHECK (pre_auction_quantity + allocated_quantity <= total_quantity)
CONSTRAINT chk_lot_remaining CHECK (total_quantity - pre_auction_quantity - allocated_quantity >= 0)
```

Over-allocation and negative remaining quantity are therefore **impossible at the storage
level**, independent of application code. Services additionally `SELECT … FOR UPDATE` the
lot row inside a transaction so concurrent auction taps serialize safely.

## Consistency strategy

- `pre_auction_quantity` / `allocated_quantity` are maintained incrementally during live
  operation (fast) and **recomputed from child rows** (`recomputeLotQuantities`) after every
  post-auction correction — totals always derive from facts.
- Bill totals are recomputed from `bill_items`, which mirror live allocations after any
  correction (`syncBills`); payments are preserved and bill status re-derived.
- `updated_at` triggers on every mutable table; full before/after history in `audit_log`.

## Key columns / statuses

| Table | Statuses | Notes |
|---|---|---|
| inwards | open / closed | `purchase_source` ∈ local_farmer, local_trader, outside_trader, night_arrival |
| lots | created / pre_auctioned / in_auction / allocated / closed | auto lot number `L-YYYYMMDD-NNN` |
| lot_cards | printed flag | card code = lot number |
| auctions | live / closed | one live auction per lot |
| allocations | allocated / billed / paid / cancelled | cancelled keeps audit trail |
| bills | unpaid / part_paid / paid / void | bill number `B-YYYYMMDD-NNN` |
| payments | — | method: cash / upi / bank; `received_by` user |

## Indexes

Foreign keys, `lot_date`, `inward_date`, `opened_at`, `received_at`, lower(name) for
parties/customers, allocation status, audit (entity, entity_id, created_at).

## Provisioning

- One-off on a fresh server (superuser): `node backend/provision-db.js`
  creates role `admin` / password from `.env` and database `dev`.
- `npm run migrate` applies versioned SQL files (tracked in `schema_migrations`).
  The server also migrates on startup.
- `node backend/test/reset.js` drops and re-applies the whole schema (dev only).
