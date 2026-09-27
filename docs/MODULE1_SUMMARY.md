# Module 1 Implementation Summary

## What was built

A working end-to-end implementation of the Actual Purchase, Inward & Auction workflow:

1. **PostgreSQL schema** (`sri_varahi_erp` schema, migration `001_init.sql`) with all
   required entities, FKs, indexes, timestamps, status fields, and DB-level quantity
   guards (generated `remaining_quantity` column + CHECK constraints).
2. **Node.js REST backend** (Express + pg) with all business logic in services,
   transaction-safe quantity operations, role-based authorization, and a full audit trail.
3. **React Native CLI Android app** (no Expo, zero extra runtime dependencies) with
   14 workflow screens organized around the mandi flow — the Live Auction screen puts
   lot details + rate + customer + quantity + save on one screen.
4. **Docs & tests**: API reference, database design, scenario test suite.

## Business principles → implementation

| Principle | How |
|---|---|
| Enter once | Single inward row per arrival; party/customer quick-create by name; allocations become bills automatically |
| Auto-flow | Save inward → lot number `L-YYYYMMDD-NNN` + lot card + linked vehicle/party/quality/qty; auction auto-opens on lot select |
| Minimum taps | Auction screen: tap lot chip → type rate/qty → pick or type customer name → SAVE; rate/customer persist between saves |
| Real-time totals | `remaining_quantity` is a generated column; every response returns updated totals; dashboard polls consolidated view |
| Easy correction | Authorized PATCH/transfer/split with mandatory reason; totals, bills and cashier status recompute in the same transaction |

## Test scenarios & results

Run: `cd backend && node test/reset.js && npm run test:scenarios` — **all pass**:

| # | Scenario | Result |
|---|---|---|
| 1 | 10 boxes to Customer A, 5 moved to B | ✓ transfer creates B's allocation (5), lot totals stay 10 |
| 2 | Damage reduces quantity after auction | ✓ PATCH quantity 5→4; totals & bills recompute |
| 3 | Rate change after auction | ✓ PATCH rate; bill amount follows automatically |
| 4 | Allocation split across customers | ✓ split endpoint; new customer's bill auto-created |
| 5 | New customer joins during auction | ✓ name-only creation, `details_complete=false`, completable later |
| 6 | Pre-auction taken, only remaining auctions | ✓ 10−5 pre-auction → auction sees 5; over-allocation → 409 |
| 7 | Night stock at predetermined price before final rate | ✓ multiple customers on same lot; final rate on same inward; margin = 200 computed |

Guards also verified: over-allocation (409), pre-auction over-sell (409),
over-payment (409), operator blocked from corrections (403),
`remaining = total − pre − allocated` invariant, single inward row for night arrival.

## Run commands

Backend:
```bash
cd backend && npm install
node provision-db.js   # one-time on fresh server (creates admin/dev)
npm run migrate && npm start
```

Tests: `node test/reset.js && npm run test:scenarios`

Android:
```bash
cd frontend && npm install
# one-time: generate android/ via RN CLI into a temp project and copy here
npm run android                 # debug run
cd android && gradlew assembleDebug || assembleRelease
```

## Assumptions (explicitly identified, not invented silently)

1. **One lot per inward** — the spec's flow (inward → save → lot number → lot card)
   implies one lot per arrival. The schema's UNIQUE `inward_id` makes this explicit;
   splitting an arrival into multiple lots was not requested.
2. **Night-arrival customer sales are recorded as pre-auction sales** at the
   predetermined selling price — the spec describes exactly this behavior ("multiple
   customers at predetermined price, same stock identity"), and reusing the mechanism
   avoids duplicate data structures. Trade margin is computed at final-rate time as
   `Σ(sales value) − sold_qty × final_rate`.
3. **Authorization model**: users with roles operator/supervisor/admin, identified by
   the `X-User-Id` header. The spec required "authorized users" for corrections but did
   not define authentication; a simple role model was the minimal faithful choice.
   PIN/password login can be added later without schema changes.
4. **Units**: "boxes" everywhere (spec's examples are in boxes); quantities are numeric
   to allow fractional weights if the mandi later needs kg.
5. **Local trader lots also receive lot numbers** (stock record = lot), since the spec
   says purchase → "Purchase / Stock Record" and all stock must be auctionable later.
6. **Over-payment after a downward correction** (paid amount > corrected total) leaves
   the bill "paid" with the excess as recorded payment history (cashier credit); the
   spec did not define refund handling.
7. **Auction can be reopened** for a lot with remaining quantity (status "allocated"),
   since the spec allows post-auction changes without restarting transactions.
8. **Backend port 3000**; Android emulator reaches it via `10.0.2.2` (change
   `API_BASE` for physical devices).
