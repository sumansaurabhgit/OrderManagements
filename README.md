# Larkspur Goods: Order Management System

A production-shaped e-commerce system with three surfaces:

- **Storefront** — product listing and detail, persistent cart, Stripe Checkout, order confirmation, and “My orders” with a status timeline. Signed-in customers receive live toasts over an SSE connection when catalogue or stock events fire.
- **Stock** — units are reserved atomically at checkout, every change is written to an append-only ledger, and overselling is impossible.
- **Admin** — product CRUD with image upload, stock adjustments with a reason, order search and filtering, server-validated status transitions, and full refunds through Stripe.

**Stack:** Next.js 16 (App Router, TypeScript strict), Supabase (Postgres + RLS, Auth, Storage), Stripe Checkout (test mode), Tailwind CSS. Designed to run on Vercel.

| | |
|---|---|
| Live URL | https://order-managements.vercel.app |
| Customer | `customer@example.com` / `Password123!` |
| Admin | `admin@example.com` / `Password123!` |

Deeper file-level notes: [IMPLEMENTATION_DETAILS.md](IMPLEMENTATION_DETAILS.md). The same technical write-ups below also live in [DECISIONS.md](DECISIONS.md).

---

## Prerequisites

- **Node.js** ≥ 20.12 (developed on 24)
- **Docker Desktop**, running, for the local Supabase stack (Postgres, Auth, Storage, Studio, Mailpit)
- A **Stripe account in test mode** and the [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe login` once)

The Supabase CLI is a project dev dependency, so `npx supabase …` works with no global install.

---

## Local setup (step by step)

**Do not commit or email a real `.env` / `.env.local`.** Secrets stay out of git (`.env*` is ignored except `.env.example`). Reviewers copy the example file and fill it from **their** local Supabase stack and **their** Stripe test keys. The seeded login emails/passwords are in this README; they are not secrets.

After cloning, open **three terminals** in the repo root for steps 3, 6 and 7. They stay running.

### 1. Clone the repository

```bash
git clone https://github.com/sumansaurabhgit/OrderManagements.git
cd OrderManagements
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the local Supabase stack

```bash
npx supabase start
```

Wait until it prints URLs and keys. Studio is at http://127.0.0.1:54323. Mailpit (local auth emails, including password-reset links) is at http://127.0.0.1:54324.

### 4. Apply schema, RLS, functions and seed data

```bash
npx supabase db reset
```

This applies every file in `supabase/migrations/` and runs `supabase/seed.sql`: two confirmed users (`customer@example.com` and `admin@example.com`, password `Password123!`) and a sample catalogue (including a last-unit product, an out-of-stock product, and an inactive product).

### 5. Create `.env.local` from the example (you do not receive a filled `.env`)

The repo already includes `.env.example` with the variable names and comments. Copy it once:

```bash
cp .env.example .env.local
```

Fill `.env.local` from `npx supabase status -o env` (or the output of `npx supabase start`):

| Variable from `status -o env` | Put in `.env.local` as |
|---|---|
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` (usually `http://127.0.0.1:54321`) |
| `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Also set:

| Variable | Local value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → **test** secret (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | from step 6 (`whsec_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | optional; hosted Checkout does not need it |

Leave `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` **without** a `NEXT_PUBLIC_` prefix. Those modules import `server-only`, so a client import fails the build.

If you also keep **hosted** Supabase keys in `.env.local`, put the **Docker** values in `.env.development.local` instead. `next dev` prefers that file, so local work uses Docker and production builds can still use hosted keys.

### 6. Forward Stripe webhooks (keep this terminal open)

```bash
stripe login
npm run stripe:listen
```

That runs:

```bash
stripe listen --events checkout.session.completed,checkout.session.expired,payment_intent.succeeded,payment_intent.payment_failed,charge.refunded --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` in `.env.local`. You can reprint it with `stripe listen --print-secret`. Restart `npm run dev` after changing the secret.

Without this process, checkout still redirects to Stripe, but orders stay **Awaiting payment** because the webhook never reaches the app.

### 7. Run the app

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the customer or admin account above.

### Useful local URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit | http://127.0.0.1:54324 |
| Supabase API | http://127.0.0.1:54321 |

### Repair test users (optional)

`npx supabase db reset` already creates both accounts. To recreate or promote a user without a full reset:

```bash
npm run seed:users
npm run seed:users -- --promote you@example.com
```

Roles live in `profiles.role`. Customers cannot change them: `authenticated` has no `UPDATE` grant on that column.

### Tests and checks

```bash
npm run lint
npm run typecheck
npm run build
npm run db:test              # pgTAP: RLS, privileges, stock, state machine, webhook idempotency
npm run test:concurrency     # 24 concurrent buyers, 3 units; exactly 3 must succeed
```

### Testing payments locally

1. Sign in as the customer, add products, click **Checkout**.
2. Pay with **`4242 4242 4242 4242`**, any future expiry, any CVC. The confirmation page shows *Confirming your payment…* until `checkout.session.completed` marks the order **Paid**. The Stripe redirect never changes status by itself.
3. Try **`4000 0000 0000 0002`**. Stripe shows the decline and keeps Checkout open. The webhook records the attempt; it does **not** cancel the order. Stock is released when the session expires, when the customer or an admin cancels, or when the shopper leaves Checkout / changes the cart (app cancel + later `checkout.session.expired` is idempotent).
4. Replay an event (`stripe events resend evt_…`). The app returns `200` and does not apply the event twice. **Admin → Webhook events** shows the outcome and duplicate count.
5. Refund a paid order from **Admin → Orders → order → Issue full refund**. Status and stock update when `charge.refunded` arrives.

Webhook events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.

### Auth emails (sign-up and password reset)

Email delivery works locally through **Mailpit**, not a real inbox.

1. On `/login`, use **Forgot your password?** (or sign up a new address).
2. Open http://127.0.0.1:54324 — the message, including the reset or confirm link, lands there.
3. Follow the link back to the app and set a new password.

On the hosted site the same flows work once Supabase Auth has **custom SMTP** (for example Resend). Without SMTP, Supabase’s built-in mailer only delivers to project team members.

### Live toasts and SSE

Signed-in users keep an SSE connection to `/api/events`. Product create / update / deactivate and stock changes write a row to `storefront_events`; the stream forwards those events and a **toast** appears (for example when an admin edits a product while a customer is on the shop).

How to see it:

1. Sign in as the **customer** and leave `/` open.
2. In another tab, sign in as **admin**, create or edit a product, or adjust stock.
3. The customer tab should toast. Anonymous visitors do not subscribe (RLS on events is `authenticated` only).

In `next dev`, the SSE request can return a short `200` on hot reload; that is HMR, not a production bug. After reconnect the stream works again for later events.

---

## Environment variables

| Variable | Browser | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Stripe success/cancel URLs and auth email links |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key; all data access is governed by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | Stripe webhook and attaching a Checkout Session to an order |
| `STRIPE_SECRET_KEY` | **no** | Create Checkout Sessions, refunds, expire sessions |
| `STRIPE_WEBHOOK_SECRET` | **no** | Verify webhook signatures |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Optional |

---

## Approach to stock reservation and concurrency

Stock is **decremented when the order is created**, not when Stripe confirms payment, and released if the order is never paid. Checkout calls one Postgres function, `create_order_and_reserve_stock`, in a **single transaction**:

1. **Lock inventory rows** with `SELECT … FOR UPDATE`, in ascending `product_id` order. Two buyers racing for the last unit of the same SKU queue on that row. The first decrements `on_hand` and commits; the second sees the new count and fails with `INSUFFICIENT_STOCK`. The whole checkout rolls back — no partial order.
2. **One lock order everywhere.** Reservation, release, refund restock and admin adjustments all take inventory locks in the same `product_id` order, so concurrent carts cannot deadlock.
3. **The client never sends prices.** The browser posts `{product_id, quantity}` only. Prices come from `products` and are snapshotted into `order_items`.
4. **`CHECK (on_hand >= 0)`** is the last line of defence if application code has a bug.

`scripts/concurrency-test.mjs` fires 24 concurrent reservations from two accounts at 3 units. Exactly 3 succeed.

Reservations are released under the same locks when: the customer abandons Stripe Checkout or edits the cart, `checkout.session.expired` fires, the customer or an admin cancels, a refund restocks, or Stripe session creation fails (immediate compensation). Sessions last 31 minutes; a user may hold at most five unpaid orders, which bounds stock hoarding.

A declined card does **not** cancel the order. Cancelling or expiring the session on `payment_intent.payment_failed` would race a retry or replace Stripe’s decline screen. The failure is recorded; stock is released later on expiry, cancel, or abandon. If money still arrives after cancellation, the webhook issues an automatic refund.

---

## How webhook idempotency is achieved

Stripe may deliver the same event more than once. The handler verifies the signature against the **raw body**, then calls `handle_stripe_webhook_atomic` — **one database transaction** that both records the event and applies its effect.

The gate is the Stripe **event id** (`evt_…`), stored as the primary key of `stripe_events`:

```sql
INSERT INTO stripe_events (id, …)
VALUES (p_event_id, …)
ON CONFLICT (id) DO NOTHING;
```

- **First delivery** — the insert succeeds; the function locks the order (`FOR UPDATE`) and applies the transition only if the order is in the expected state.
- **Replay** — the insert conflicts; `duplicate_count` is incremented; the order and stock are **not** changed again. The app still returns **200** so Stripe stops retrying.

The insert and the order/stock updates commit or roll back **together**, so an event cannot be marked seen without being applied, and a replay cannot apply twice. Concurrent deliveries of the same `evt_…` serialise on that primary key.

A second layer covers **different** events for the same payment: `checkout.session.completed` and `payment_intent.succeeded` both mean “paid”, but only the first moves the order (`ignored_already_paid` for the other). Unknown events (for example `stripe trigger` fixtures) are recorded and acknowledged with 200. Real processing failures return **500** so Stripe retries.

This is separate from Stripe **API** idempotency keys (for example `checkout-session-<orderId>` when creating a session). Those stop duplicate *API calls*; `stripe_events.id` stops duplicate *webhook applications*.

---

## RLS policy design, and one policy that was tricky

Security is layered. The Next.js proxy only refreshes the session and redirects unsigned visitors. Every admin page and Server Action re-checks the user and `profiles.role`. **Postgres is the real boundary:**

- Table privileges are revoked, then granted **column by column**. RLS is on every table.
- Customers read their own orders, items and profile. Anonymous visitors read **active** products. Admins read everything.
- Nobody writes `orders`, `inventory` or `stock_movements` with ordinary SQL. Only `SECURITY DEFINER` functions do, so the ledger stays complete even for admins.
- `EXECUTE` is revoked from `PUBLIC` and granted explicitly. Postgres otherwise lets anyone call webhook RPCs over `/rpc`.
- Webhook functions are granted to `service_role`. Admin functions check `is_admin()` themselves.
- Internal helpers live in an unexposed `private` schema.
- A trigger enforces the order state machine for every writer, including the service role.
- The stock ledger cannot be updated or deleted, even with the service-role key.

**The tricky policy: show live stock without exposing inventory.** The storefront must display availability and cap quantities, but customers must not read `inventory` or `stock_movements` (that would leak the ledger and warehouse history). Opening those tables to `authenticated` is too wide; a view can also bypass the intended grants.

The solution is a **read-only mirror**. A `SECURITY DEFINER` trigger copies `inventory.on_hand` onto `products.available_stock`. The `authenticated` role has **no `UPDATE`** on that column. The public catalogue shows how many units are left; the inventory tables stay admin-only.

A close second was `profiles`. A naive “users may update their own row” policy lets anyone run `UPDATE profiles SET role = 'admin'`. Instead `authenticated` can update only `display_name`, and the role is never taken from signup metadata. The pgTAP suite covers both cases.

---

## What I would do with another week

- **Wishlist** — persist saved products per account (not only `localStorage` cart) so customers can return to items that were out of stock.
- **Dynamic pricing** — price by remaining availability (for example last-few-units premium) and by location / shipping zone, still snapshotted onto `order_items` at reservation time so Stripe never charges a stale amount.
- **Redis** — not as a replacement for Postgres `FOR UPDATE` on stock (that must stay in the database), but for rate-limiting checkout and auth, catalogue cache, and an optional short lock around Stripe session creation so a double-click cannot start two sessions before the first RPC finishes.
- **Discounts** — promo codes or percentage off, validated in the same reservation transaction, with the discounted total sent to Stripe.
- **Reviews** — ratings and comments on products, RLS so customers write only their own reviews, moderated in admin.
- **Reconciliation job** — compare pending/paid orders with Stripe in case a webhook is lost.
- **Playwright** — end-to-end tests in CI, including Stripe Checkout with test cards.

---

## What was cut for time, and why

- **Cart lives in `localStorage`, not the database.** Server-side carts and guest checkout would need extra tables, merge-on-login, and more RLS. Checkout still requires a signed-in account so reservations always have a `user_id`.
- **Single currency (GBP), no tax or shipping**, which the brief allows. Multi-currency and tax would change totals sent to Stripe and the ledger.
- **No wishlist, reviews, or discount codes** — the brief’s core is catalogue, reservation, payments, admin and security; those extras were left for a follow-up week.
- **Replaced product images are not garbage-collected** from Supabase Storage. Safe, but storage would grow with many re-uploads.
- **No analytics** beyond dashboard counts (orders by status, low stock).

---

## Project layout

```
src/
  app/                    Routes (pages, layouts, route handlers)
    admin/                Admin panel (every page calls requireAdmin())
    api/webhooks/stripe/  Stripe webhook (signature-verified, idempotent)
    auth/callback/        Email link landing (PKCE)
  features/               Server actions, queries, client components
  components/             Shared UI
  lib/                    Supabase clients, auth guards, Stripe, env
  proxy.ts                Session refresh + coarse route gating
  types/database.ts       Generated schema types (`npm run db:types`)
supabase/
  migrations/             Schema, RLS, functions, storage policies
  seed.sql                Test users + catalogue
  tests/database/         pgTAP suite
scripts/                  seed-users.mjs, concurrency-test.mjs
```

Product images are stored in **Supabase Storage** (`product-images` bucket), not Vercel Blob. The database keeps only `products.image_url`.
