# Sri Varahi ERP — Module 1

## Actual Purchase, Inward & Auction Workflow

```
Purchase Source → Inward → Lot → Lot Card → [Pre-Auction] → Remaining Qty
  → Live Auction → Customer Allocation → Billing → Cashier → Post-Auction Changes
```

**Stack**: React Native CLI (Android only, no Expo) · Node.js REST API · PostgreSQL

## Project structure

```
sri_varahi_erp/
├── backend/                     # Node.js REST API
│   ├── .env                     # local config (never commit)
│   ├── .env.example
│   ├── package.json
│   ├── check-db.js              # connectivity helper
│   ├── provision-db.js          # one-time: creates role "admin" + db "dev"
│   ├── src/
│   │   ├── index.js             # server bootstrap (migrates on start)
│   │   ├── config/env.js        # env validation
│   │   ├── database/
│   │   │   ├── db.js            # pg pool + withTransaction
│   │   │   ├── migrate.js       # SQL migration runner
│   │   │   ├── seed.js          # default users
│   │   │   └── migrations/001_init.sql
│   │   ├── middleware/          # auth (X-User-Id + roles), error handler
│   │   ├── routes/index.js
│   │   ├── controllers/         # thin HTTP handlers
│   │   ├── services/            # ALL business logic & validation
│   │   └── (validations live inside services/helpers.js)
│   └── test/
│       ├── reset.js             # drop & re-apply schema
│       ├── smoke.js             # quick API smoke test
│       └── scenarios.js         # all 7 real-life scenarios
└── frontend/                    # React Native CLI app (Android)
    ├── App.js                   # in-app navigator (no nav library)
    ├── index.js, app.json, package.json, babel/metro config
    └── src/
        ├── api.js               # REST client (never touches PostgreSQL)
        ├── components/ui.js     # shared UI kit
        └── screens/             # 14 workflow screens
```

Docs: [API reference](docs/API.md) · [Database design](docs/DATABASE.md) ·
[Module 1 summary, tests & assumptions](docs/MODULE1_SUMMARY.md)

## Backend — run

```bash
cd backend
npm install
# first time on a fresh PostgreSQL server (superuser, one-off):
#   node provision-db.js        # creates role admin/123 and database dev
npm run migrate                 # applies schema (also runs automatically on start)
npm start                       # serves http://localhost:3000/api
```

`.env` (see `.env.example`):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dev
DB_SCHEMA=sri_varahi_erp
DB_USER=admin
DB_PASSWORD=123
PORT=3000
```

## Login & user management

The app opens with a login screen offering two roles: **Super Admin** and **Admin**.

**Default Super Admin credentials** (seeded, password stored hashed):

| Username     | Password         | Role        |
| ------------ | ---------------- | ----------- |
| `superadmin` | `SuperAdmin@123` | super_admin |

Flow:

1. Super Admin logs in → **USER CREATION** tile on the dashboard.
2. Created Admin users get the default password `pass@123` (hashed in the DB)
   and **must set a new password on first login** before any ERP access.
3. **Forgot password**: enter registered phone/email → OTP (valid 10 min,
   single-use, max 5 attempts) → set a new password → log in.
   In development the OTP is also returned as `dev_otp` in the API response
   (and logged server-side) so the flow can be tested without an SMS/email
   gateway; in production `NODE_ENV=production` hides it — plug a gateway
   into `auth.service.js:deliverOtp`.

Passwords and OTP codes are stored only as scrypt hashes — never plain text.

Legacy seeded demo users (Operator/Supervisor/Admin) have no credentials and
cannot log in; create real users via the Super Admin.

## Tests

```bash
cd backend
node test/reset.js        # clean slate (drops & re-applies schema)
npm run test:scenarios    # runs all 7 real-life scenarios end-to-end
npm run test:auth         # full auth flow: SA login → create admin → forced
                          # reset → ERP access → forgot password → OTP → login
node test/smoke.js        # quick flow check
```

## Frontend (Android) — run

The `frontend/` folder is a complete React Native CLI project including the
generated `android/` native project (RN 0.75.4, package `com.srivarahierp`).

> Note: this machine has Build-Tools 35 / platform 36 / NDK 27 installed, so
> `android/build.gradle` uses those instead of the template defaults (34/26).

```bash
cd frontend
npm install
npm run android            # = react-native run-android (emulator/device via ADB)
npm start                  # Metro bundler (if not auto-started)

# builds (set JAVA_HOME to Android Studio's JBR / JDK 17+)
cd android && gradlew assembleDebug
cd android && gradlew assembleRelease
```

API base URL: `http://10.0.2.2:3000/api` (Android emulator → host loopback).
For a physical device, change `API_BASE` in `frontend/src/api.js` to the
backend machine's LAN IP. Only `react` + `react-native` dependencies — no Expo,
no navigation libraries (lightweight in-app navigator in `App.js`).

## Login users (seeded)

| User                                      | Role                          | Can do                                                           |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| `superadmin`                              | super_admin                   | login + user creation (create/reset Admin users)                 |
| Operator / Supervisor / Admin (demo rows) | operator / supervisor / admin | legacy demo rows — no credentials, cannot log in until given one |
