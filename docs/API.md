# API Reference — Module 1

Base URL: `http://<host>:3000/api`

**Auth**: every business endpoint requires header `X-User-Id: <id>` (seeded users 1=Operator, 2=Supervisor, 3=Admin).
Corrections and night-arrival final-rate require role `supervisor` or `admin` (403 otherwise).

Errors: JSON `{ "error": "message" }` with 400/401/403/404/409.

## Masters

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/users` | — | public, for login screen |
| GET | `/vehicles` | — | today's lot count per vehicle |
| POST | `/vehicles` | `{vehicle_number*, vehicle_name, driver_name, driver_phone}` | Vehicle Master |
| PUT | `/vehicles/:id` | partial fields | |
| GET | `/parties?type=farmer\|local_trader\|outside_trader&q=` | | search |
| POST | `/parties` | `{name*, party_type*}` | |
| PUT | `/parties/:id` | partial | |
| GET | `/customers?q=&incomplete=true` | | search; `incomplete` lists quick-created |
| POST | `/customers` | `{name*}` | |
| PUT | `/customers/:id` | `{phone, address}` | completing details later |

## Inward (four purchase-source flows)

All four create the Inward **once**, auto-generate the **Lot Number** (`L-YYYYMMDD-NNN`),
create the **Lot Card**, and link vehicle/party/quality/quantity.

| Method | Path | Body |
|---|---|---|
| POST | `/inwards/local-farmer` | `{vehicle_id* (Vehicle Master), party_id \| party_name*, quality, quantity*}` |
| POST | `/inwards/local-trader` | `{party_id \| party_name*, quantity*, purchase_rate*}` |
| POST | `/inwards/outside-trader` | `{party_id \| party_name*, vehicle_number*, vehicle_name, driver_name, driver_phone, quality, quantity*}` |
| POST | `/inwards/night-arrival` | `{party_id \| party_name*, vehicle_number*, driver_name, quality, quantity*, selling_price*}` |
| GET | `/inwards?date=&source=` | today by default |
| GET | `/inwards/consolidated?date=` | vehicle-wise lot count & boxes, source-wise, today's totals — **derived from inward data only** |
| POST | `/inwards/:id/final-rate` 🔒 | `{final_rate*}` — night arrival: fixes morning rate on the **same** inward, computes `trade_margin = Σ(sales) − qty × final_rate` |

If `party_name` is given instead of `party_id`, the party is found case-insensitively or created on the fly (ENTER ONCE).

## Lots & Lot Cards

| Method | Path | Notes |
|---|---|---|
| GET | `/lots?date=&status=&q=` | today's lots by default |
| GET | `/lots/:id` | full identity: vehicle, party, quality, quantities, pre-auction sales, allocations, card code |
| POST | `/lots/:id/card-printed` | mark lot card printed |

## Pre-Auction

| Method | Path | Body |
|---|---|---|
| POST | `/lots/:lotId/pre-auction` | `{customer_id \| customer_name*, quantity*, rate*}` |
| GET | `/pre-auction?date=` | |

Rejects quantity beyond remaining (409). Also used for **night-arrival customer sales**
at the predetermined price — same stock identity, no duplicate inward.

## Live Auction

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/auctions` | `{lot_id*}` — opens (or resumes) auction; 409 if nothing remaining |
| GET | `/auctions/:id` | lot details auto-appear + allocations + totals |
| POST | `/auctions/:id/allocations` | `{customer_id \| customer_name*, quantity*, rate*}` — one-tap save; new customers created instantly |
| POST | `/auctions/:id/close` | optional close |
| GET | `/auctions?date=&status=` | |

## Billing

| Method | Path | Notes |
|---|---|---|
| POST | `/billing/auction/:id` | one bill per customer (`B-YYYYMMDD-NNN`) built from allocations — no re-entry |
| GET | `/bills?date=&status=&customer_id=` | today by default |
| GET | `/bills/:id` | items, payments, balance |

## Cashier

| Method | Path | Body |
|---|---|---|
| POST | `/bills/:id/payments` | `{amount*, method: cash\|upi\|bank}` — rejects over-payment; auto status paid/part_paid |
| GET | `/cashier/summary?date=` | collected, by method, outstanding |

## Post-Auction Corrections 🔒 (supervisor/admin)

| Method | Path | Body |
|---|---|---|
| PATCH | `/allocations/:id` | `{customer_id?, quantity?, rate?, reason*}` — damage / rate / customer change |
| POST | `/allocations/:id/transfer` | `{to_customer_id \| to_customer_name*, quantity*, reason*}` — move boxes to another customer (same rate) |
| POST | `/allocations/:id/split` | `{to_customer_id \| to_customer_name*, quantity*, rate?, reason*}` — split to a new customer |

Every correction: validates against lot quantity (409 on over-allocation), recomputes lot
totals from allocation facts, re-syncs bill items/totals/status (Cashier follows), keeps
payments intact, writes an audit row. The bill keeps its identity — no restart.

## Audit Trail

| Method | Path | Notes |
|---|---|---|
| GET | `/audit?entity=&entity_id=&limit=` | before/after JSON, reason, user, timestamp |

🔒 = supervisor/admin only.
