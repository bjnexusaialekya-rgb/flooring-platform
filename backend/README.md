# B2B Flooring Work Order Platform — Backend (Phase 1)

FloorZap replacement. Work order as root object, pricing hidden from
submitter end-to-end at the column level, role-based client/staff/admin
access, inventory + purchase orders, consolidated monthly invoicing.

# B2B Flooring Work Order Platform — Backend (Complete)

FloorZap replacement. Work order as root object, pricing hidden from
submitter end-to-end at the column level, role-based client/staff/admin
access, inventory + purchase orders, consolidated monthly invoicing,
QuickBooks Online sync, and Stripe/Square payment collection.

## What's built

- Full schema: property → building → unit hierarchy, client rate cards
  with price/cost snapshotting, floor plan templates, billing batches,
  payments, QBO tokens + dead-letter queue
- Custom JWT auth + 3-tier role middleware
- Work order creation from a floor plan template (server computes
  quantities from `room_manifest`, client never sends price fields)
- The pricing-blind client portal view — column-level boundary, not
  row-level; verified by an integration test that checks price KEYS
  are structurally absent, not just null (ran clean against a live DB)
- Staff pricing endpoint with cost-basis snapshotting
- Status transition endpoint enforcing the locked status flow
- Inventory adjustments + purchase orders
- Consolidated monthly billing batch creation
- **QuickBooks Online**: self-healing OAuth2 token manager (proactive
  refresh at the 50-min mark, refresh token always rotated in storage),
  consolidated invoice sync (one invoice per billing batch, not per
  work order), dead-letter queue with a retry endpoint for anything
  QBO rejects or throttles
- **Payments**: Stripe (PaymentIntent flow) and Square (Payments API)
  both fully implemented behind one `PAYMENT_PROVIDER` env var switch
  — the client's RFP left this undecided, so flipping providers later
  needs zero code changes. Both compute the charge amount server-side
  from the DB total, never trusting a client-supplied number.
- Stripe webhook: raw-body-before-json-parsing, signature verification,
  `processed_webhooks` idempotency, and `payment_intent.succeeded` /
  `payment_failed` now actually update `payments` and close out the
  `billing_batches` row (previously a TODO stub — now wired)

## Verified, not just written

Every route above was exercised against a real local Postgres 16
instance in the build sandbox: migration applied clean, full
auth/role-403 matrix confirmed, pricing boundary test passed against
a live server response, Square's SDK request/response field names
were checked against its actual TypeScript definitions (not assumed
from memory — a version guess was wrong once already and got caught
this same way), and the $0-payment guard was confirmed to return a
clean 400 instead of crashing.

## What's NOT built yet

- The React/TypeScript frontend (separate deliverable — see
  `frontend/` if present, or ask for it)
- Frontend-side Stripe.js / Square Web Payments SDK integration (the
  backend returns a `clientSecret` or expects a `sourceId` — the
  browser-side collection UI itself is a frontend concern)

## Laptop setup

You need: Node 22 LTS (you have it), Docker Desktop (or a native
Postgres install), and that's it.

### 1. Start Postgres

From the `flooring-platform/` root (one level up from `backend/`):

```bash
docker compose up -d
```

This starts Postgres on `localhost:5434` — deliberately not 5433,
since `enterprise-rag-postgres` already owns that port and must never
be touched.

If you'd rather not use Docker, install Postgres natively and just
update `DATABASE_URL` in `.env` to point at it — nothing else changes.

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Then generate a real JWT secret and paste it into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Stripe/Square/QBO credentials are only needed once you're actually
testing those integrations — everything else runs fine without them.

### 4. Run migrations

```bash
npm run migrate
```

### 5. Seed sample data

```bash
node src/db/seed.js
```

This prints an admin login (`admin@bjnexus.local` / `ChangeMe123!` —
change this password before this ever goes near production) and a
`TEST_CLIENT_TOKEN` / `TEST_WORK_ORDER_ID` pair for the pricing test.

### 6. Start the server

```bash
npm run dev
```

Server runs on `http://localhost:4000`. Hit `/health` to confirm it's up.

### 7. Run the pricing-boundary test

In a second terminal, with the server still running from step 6:

```bash
export TEST_CLIENT_TOKEN="<paste from seed output>"
export TEST_WORK_ORDER_ID="<paste from seed output>"
npm test
```

This must pass before anything touches production — it's the
equivalent of the Bigfella build's "test RLS in SQL Editor before
trusting the app," adapted to this app's column-level boundary
instead of Postgres RLS.

## API quick reference

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /auth/login | any | Get JWT |
| POST | /auth/register | admin | Create staff/client users |
| POST | /work-orders | client/staff/admin | Submit work order from template |
| GET | /work-orders/:id/portal-view | any (self-scoped) | Pricing-blind view |
| PATCH | /work-orders/:id/line-items/:lineItemId/price | staff/admin | Set price, snapshots cost basis |
| PATCH | /work-orders/:id/status | staff/admin | Move through locked status flow |
| GET | /inventory | staff/admin | Stock levels + reorder flags |
| POST | /inventory/:materialId/adjust | staff/admin | Stock in/out |
| POST | /inventory/purchase-orders | staff/admin | Create PO |
| POST | /billing/consolidated-statement | staff/admin | Batch completed WOs for a property |
| GET | /billing/batches/:id | staff/admin | Full batch detail (prices included — staff-only) |
| GET | /qbo/connect-url | admin | Get Intuit OAuth consent URL |
| GET | /qbo/callback | admin | OAuth redirect target (Intuit calls this) |
| POST | /qbo/batches/:id/sync | admin | Push consolidated invoice to QBO |
| GET | /qbo/sync-failures | admin | List unresolved dead-letter entries |
| POST | /qbo/sync-failures/:id/retry | admin | Retry a failed QBO sync |
| POST | /payments/create | staff/admin | Create Stripe PaymentIntent or Square payment |
| POST | /webhooks/stripe | Stripe only | Payment webhook (signature-verified) |

## Before this touches production

- [ ] Run `npm audit --audit-level=high` clean
- [ ] Rotate the seeded admin password
- [ ] Set real `JWT_SECRET`, `STRIPE_WEBHOOK_SECRET`, `SQUARE_ACCESS_TOKEN`, `QBO_CLIENT_SECRET`
- [ ] Decide Stripe vs Square with the client, set `PAYMENT_PROVIDER` accordingly
- [ ] Run the QBO OAuth connect flow once against the client's real sandbox/production company
- [ ] Confirm `PG_POOL_MAX` matches your hosting tier's connection limit
- [ ] Add frontend XSS/CSRF hardening (not covered by this backend pass)
- [ ] Add DigitalOcean firewall rules once deployed

