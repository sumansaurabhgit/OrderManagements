# Larkspur Goods: Order Management System

A small, production-shaped e-commerce system with three surfaces:

- **Storefront**: product listing and detail pages, a persistent cart, Stripe Checkout, order confirmation, and "My orders" with a status timeline.
- **Stock management backend**: stock is reserved atomically, stock movements go to an append-only ledger, and overselling is impossible.
- **Admin panel**: product CRUD with image upload, stock adjustments with a reason, order search and filtering, server-validated status transitions, and full refunds through Stripe.

**Stack:** Next.js 16 (App Router, TypeScript strict), Supabase (Postgres + RLS, Auth, Storage), Stripe Checkout (test mode), and Tailwind CSS. It is designed to be deployed on Vercel.

| | |
|---|---|
| Live URL | _add after deploying_ |
| Customer | `customer@example.com` / `Password123!` |
| Admin | `admin@example.com` / `Password123!` |

---

## Prerequisites

- Node.js ≥ 20.12 (developed on 24)
- Docker Desktop, for the local Supabase stack
- [Stripe CLI](https://docs.stripe.com/stripe-cli) and a Stripe account in test mode

The Supabase CLI is a dev dependency, so `npx supabase …` works with no global install.

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase locally (Postgres, Auth, Storage, Studio, Mailpit)
npx supabase start

# 3. Apply migrations and seed data (test users and products)
npx supabase db reset

# 4. Configure environment variables (see the reference below)
cp .env.example .env.local
#    Fill in the Supabase values printed by `npx supabase status -o env`
#    (API_URL, ANON_KEY, SERVICE_ROLE_KEY), plus your Stripe test secret key.

# 5. Forward Stripe webhooks to the app (keep this running in its own terminal)
stripe login
npm run stripe:listen
#    = stripe listen --events checkout.session.completed,checkout.session.expired,
#        payment_intent.succeeded,payment_intent.payment_failed,charge.refunded
#        --forward-to localhost:3000/api/webhooks/stripe
#    (Recent Stripe CLI versions require --events.) Copy the printed signing secret
#    (whsec_…) into STRIPE_WEBHOOK_SECRET, or get it with `stripe listen --print-secret`.

# 6. Run the app
npm run dev        # http://localhost:3000
```

Useful local URLs:
- Supabase Studio: http://127.0.0.1:54323
- Mailpit: http://127.0.0.1:54324. Local auth emails, including password-reset links, land here.

> **Tip: keeping hosted and local keys apart.** If `.env.local` holds your hosted Supabase keys, put the local Docker values in `.env.development.local`. `next dev` gives that file precedence, so development uses Docker while production builds use the hosted project. The scripts follow the same precedence.

## Environment variables

| Variable | Exposed to browser | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Base URL for Stripe success/cancel URLs and auth email links |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key. All data access is governed by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | Used only by the Stripe webhook and to store a server-created Checkout Session on its order |
| `STRIPE_SECRET_KEY` | **no** | Creates Checkout Sessions and refunds, and expires sessions |
| `STRIPE_WEBHOOK_SECRET` | **no** | Verifies webhook signatures |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Optional. Hosted Checkout doesn't need it. |

The secret-reading modules import `server-only`, so the build fails if any of them is ever pulled into client code.

## Testing payments

1. Sign in as the customer, add products to the cart, and click **Checkout**.
2. Pay with **`4242 4242 4242 4242`**, any future expiry date and any CVC. You land on the confirmation page, which shows *Confirming your payment…* until the `checkout.session.completed` webhook marks the order **Paid**. The redirect itself never changes the order status.
3. Try **`4000 0000 0000 0002`**. Stripe declines the card, and the `payment_intent.payment_failed` webhook records the attempt and **expires the Checkout Session**. Stripe then sends `checkout.session.expired`, which cancels the order and releases the reserved stock. Cancellation waits for the session to expire, so a successful retry can never be charged against a cancelled order.
4. Replay any event. Replays are acknowledged with `200` and never processed twice:
   ```bash
   stripe events list --limit 5
   stripe events resend evt_XXXXXXXX
   stripe trigger checkout.session.completed   # events with no matching order are acknowledged and ignored
   ```
   **Admin → Webhook events** lists each event's outcome and how many duplicate deliveries were ignored.
5. Refund a paid order: **Admin → Orders → order → Issue full refund**. This calls `refunds.create`. The order then moves to **Refunded**, and its stock is returned, when the `charge.refunded` webhook arrives.

Webhook events used: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.

## Seeding an admin user

- **Locally**, `npx supabase db reset` creates both test accounts from `supabase/seed.sql`.
- **On any project, including hosted**, use the Auth Admin API script:
  ```bash
  npm run seed:users                            # local: create or repair both test accounts
  npm run seed:users -- --hosted                # same, against the project in .env.local
  npm run seed:users -- --promote you@example.com [--hosted]   # make an existing user an admin
  ```
  The role is stored in `profiles.role`. Users can't change it themselves: the column isn't updatable by the `authenticated` role.

## Tests and checks

```bash
npm run lint              # ESLint (next/core-web-vitals + TypeScript)
npm run typecheck         # tsc --noEmit
npm run build             # production build
npm run db:test           # pgTAP: 50 tests covering RLS, privileges, stock, the state machine, webhook idempotency
npm run test:concurrency  # 24 concurrent buyers race for 3 units; exactly 3 must win
```

## Deploying (Supabase Cloud + Vercel)

1. **Database.** Create a Supabase project, then:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push                  # applies supabase/migrations
   npm run seed:users -- --hosted        # test accounts (needs the hosted keys in .env.local)
   ```
   To load the sample catalogue as well, run `supabase/seed.sql` once in the SQL editor, or use `npx supabase db push --include-seed`.
2. **Supabase Auth settings.**
   - Set the **Site URL** to the Vercel URL, and add `https://<app>.vercel.app/**` to the redirect URLs.
   - Configure **custom SMTP** (for example Resend). Supabase's built-in mailer only delivers to project team members, so reviewers would never receive sign-up or password-reset emails without it.
3. **Vercel.** Import the GitHub repository and set every variable from the table above. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. **Stripe.** In the Dashboard (test mode), go to Developers → Webhooks and add an endpoint at `https://<app>.vercel.app/api/webhooks/stripe` with the five events listed above. Put its signing secret in `STRIPE_WEBHOOK_SECRET` and redeploy.

## Project layout

```
src/
  app/                    Routes (pages, layouts, route handlers)
    admin/                Admin panel (layout + every page call requireAdmin())
    api/webhooks/stripe/  Stripe webhook (signature-verified, idempotent)
    auth/callback/        Email link landing (PKCE code / token_hash)
  features/               Feature modules: server actions, queries, client components
    admin/ auth/ cart/ catalogue/ checkout/ orders/ payments/
  components/             Shared presentational components (+ ui/ primitives)
  lib/                    Infrastructure: Supabase clients, auth guards, Stripe, env, money
  proxy.ts                Session refresh + coarse route gating (Next 16's "middleware")
  types/database.ts       Generated from the schema (`npm run db:types`)
supabase/
  migrations/             Schema, RLS, functions, storage policies
  seed.sql                Test users + catalogue
  tests/database/         pgTAP suite
scripts/                  seed-users.mjs, concurrency-test.mjs
```
