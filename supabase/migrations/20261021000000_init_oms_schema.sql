-- =============================================================================
-- Order Management System — initial schema
--
-- Design principles
--   * Every business invariant lives in the database: stock can never go
--     negative (CHECK), order status can only move along the allowed state
--     machine (trigger), and every multi-row change runs inside one
--     transactional function.
--   * Clients get the narrowest privileges possible. Table privileges are
--     revoked and re-granted per column, and RLS is enabled on every table.
--     Writes to orders, inventory and the stock ledger happen only through
--     SECURITY DEFINER functions with explicit EXECUTE grants.
--   * Internal helpers live in the `private` schema, which PostgREST does not
--     expose, so they cannot be called over /rest/v1/rpc.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'admin');

create type public.order_status as enum (
  'pending_payment',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded'
);

create type public.stock_movement_type as enum (
  'initial_stock',
  'order_reserved',
  'order_released',
  'order_refunded',
  'manual_adjustment'
);

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  role         public.user_role not null default 'customer',
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  description     text not null default '' check (char_length(description) <= 5000),
  -- Minor units (pence). Stripe rejects zero-value card payments, so > 0.
  price           integer not null check (price > 0 and price <= 99999999),
  image_url       text check (image_url is null or image_url ~ '^(https?://|/)'),
  is_active       boolean not null default true,
  -- Public, read-only mirror of inventory.on_hand maintained by trigger, so the
  -- storefront can show availability without any access to the inventory table.
  available_stock integer not null default 0 check (available_stock >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index products_active_created_idx on public.products (created_at desc) where is_active;

create table public.inventory (
  product_id uuid primary key references public.products (id) on delete cascade,
  on_hand    integer not null default 0 check (on_hand >= 0),
  updated_at timestamptz not null default now()
);

-- Append-only stock ledger. on_hand_after makes the ledger self-verifying:
-- each row records the balance the change produced.
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete restrict,
  movement_type public.stock_movement_type not null,
  delta         integer not null check (delta <> 0),
  on_hand_after integer not null check (on_hand_after >= 0),
  reason        text not null check (char_length(btrim(reason)) between 1 and 200),
  reference     text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  -- Human-friendly reference for support / admin search (e.g. #1042).
  order_number             bigint generated always as identity (start with 1001) unique,
  user_id                  uuid not null references public.profiles (id) on delete restrict,
  customer_email           text not null,
  status                   public.order_status not null default 'pending_payment',
  currency                 text not null default 'gbp' check (currency ~ '^[a-z]{3}$'),
  total_amount             integer not null check (total_amount >= 0),
  stripe_session_id        text unique,
  stripe_checkout_url      text,
  checkout_expires_at      timestamptz,
  stripe_payment_intent_id text unique,
  stripe_refund_id         text,
  -- Ordered timeline: [{ kind, status, timestamp, actor, actor_id?, note, stripe_event_id? }]
  status_history           jsonb not null default '[]'::jsonb
                           check (jsonb_typeof(status_history) = 'array'),
  paid_at                  timestamptz,
  fulfilled_at             timestamptz,
  cancelled_at             timestamptz,
  refunded_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index orders_user_created_idx   on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_created_idx        on public.orders (created_at desc);
create index orders_customer_email_trgm_idx
  on public.orders using gin (customer_email extensions.gin_trgm_ops);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  product_sku  text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   integer not null check (unit_price >= 0),
  line_total   integer generated always as (quantity * unit_price) stored,
  unique (order_id, product_id)
);

create index order_items_product_idx on public.order_items (product_id);

-- Idempotency ledger for Stripe webhooks. The primary key on the Stripe event
-- id is the idempotency gate; duplicate deliveries are counted, never replayed.
create table public.stripe_events (
  id                text primary key check (id like 'evt_%'),
  event_type        text not null,
  order_id          uuid references public.orders (id) on delete set null,
  outcome           text not null,
  duplicate_count   integer not null default 0,
  last_duplicate_at timestamptz,
  payload           jsonb,
  processed_at      timestamptz not null default now()
);

create index stripe_events_order_idx     on public.stripe_events (order_id);
create index stripe_events_processed_idx on public.stripe_events (processed_at desc);

-- -----------------------------------------------------------------------------
-- 3. Generic triggers
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Only bump updated_at for catalogue edits, not for the stock mirror sync.
create trigger products_set_updated_at
  before update of sku, name, description, price, image_url, is_active on public.products
  for each row execute function private.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Auth integration
-- -----------------------------------------------------------------------------

-- Every new auth user gets a profile. The role is ALWAYS 'customer' (column
-- default); it is never read from user-controlled signup metadata.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- Role check used by RLS policies and admin functions. SECURITY DEFINER so the
-- lookup is not itself subject to profiles RLS (avoids policy recursion).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. Inventory <-> product availability bridge
-- -----------------------------------------------------------------------------

-- Creating a product creates its inventory row; initial stock is ledgered.
create function private.init_product_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id, on_hand)
  values (new.id, new.available_stock);

  if new.available_stock > 0 then
    insert into public.stock_movements
      (product_id, movement_type, delta, on_hand_after, reason, reference, created_by)
    values
      (new.id, 'initial_stock', new.available_stock, new.available_stock,
       'Initial stock on product creation', 'product_created', auth.uid());
  end if;

  return new;
end;
$$;

create trigger products_init_inventory
  after insert on public.products
  for each row execute function private.init_product_inventory();

-- Mirrors inventory.on_hand onto products.available_stock.
create function private.sync_product_available_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products
     set available_stock = new.on_hand
   where id = new.product_id
     and available_stock <> new.on_hand;
  return null;
end;
$$;

create trigger inventory_sync_available_stock
  after insert or update of on_hand on public.inventory
  for each row execute function private.sync_product_available_stock();

-- -----------------------------------------------------------------------------
-- 6. Order state machine
-- -----------------------------------------------------------------------------

create function private.is_valid_order_transition(
  p_from public.order_status,
  p_to   public.order_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from = 'pending_payment' and p_to in ('paid', 'cancelled'))
      or (p_from = 'paid'            and p_to in ('fulfilled', 'refunded'));
$$;

-- Enforced for every writer, including the service role: no code path can
-- move an order along an edge that is not in the state machine.
create function private.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not private.is_valid_order_transition(old.status, new.status) then
    raise exception 'INVALID_STATUS_TRANSITION: Cannot transition order from % to %',
      old.status, new.status
      using errcode = 'P0001';
  end if;

  case new.status
    when 'paid'      then new.paid_at      := now();
    when 'fulfilled' then new.fulfilled_at := now();
    when 'cancelled' then new.cancelled_at := now();
    when 'refunded'  then new.refunded_at  := now();
    else null;
  end case;

  return new;
end;
$$;

create trigger orders_enforce_status_transition
  before update of status on public.orders
  for each row execute function private.enforce_order_status_transition();

create function private.history_entry(
  p_kind            text,
  p_status          public.order_status,
  p_actor           text,
  p_note            text,
  p_stripe_event_id text default null,
  p_actor_id        uuid default null
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'kind',            p_kind,
    'status',          p_status,
    'timestamp',       clock_timestamp(),
    'actor',           p_actor,
    'actor_id',        p_actor_id,
    'note',            p_note,
    'stripe_event_id', p_stripe_event_id
  ));
$$;

create function private.set_order_status(
  p_order_id        uuid,
  p_status          public.order_status,
  p_actor           text,
  p_note            text,
  p_stripe_event_id text default null,
  p_actor_id        uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.orders
     set status = p_status,
         status_history = status_history
           || private.history_entry('status_change', p_status, p_actor, p_note, p_stripe_event_id, p_actor_id)
   where id = p_order_id;
end;
$$;

create function private.add_order_note(
  p_order_id        uuid,
  p_actor           text,
  p_note            text,
  p_stripe_event_id text default null,
  p_actor_id        uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.orders
     set status_history = status_history
           || private.history_entry('note', status, p_actor, p_note, p_stripe_event_id, p_actor_id)
   where id = p_order_id;
end;
$$;

-- Returns an order's reserved units to inventory. Rows are touched in
-- product_id order — the same global lock order used by checkout — so
-- concurrent reservations and releases cannot deadlock.
create function private.release_order_stock(
  p_order_id      uuid,
  p_movement_type public.stock_movement_type,
  p_reason        text,
  p_actor_id      uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item    record;
  v_on_hand integer;
begin
  for v_item in
    select product_id, quantity
      from public.order_items
     where order_id = p_order_id
     order by product_id
  loop
    update public.inventory
       set on_hand = on_hand + v_item.quantity,
           updated_at = now()
     where product_id = v_item.product_id
    returning on_hand into v_on_hand;

    insert into public.stock_movements
      (product_id, movement_type, delta, on_hand_after, reason, reference, created_by)
    values
      (v_item.product_id, p_movement_type, v_item.quantity, v_on_hand,
       p_reason, p_order_id::text, p_actor_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Checkout: atomic order creation + stock reservation
-- -----------------------------------------------------------------------------

-- Concurrency strategy
--   1. The caller's profile row is locked first. This serialises one user's
--      concurrent checkouts so the pending-order cap cannot be raced.
--   2. Inventory rows are locked with SELECT ... FOR UPDATE in ascending
--      product_id order. Two buyers racing for the last unit queue on the same
--      row lock; the second sees the decremented on_hand and fails cleanly.
--      The single global lock order (inventory row, then its product row via
--      the sync trigger, product by product in id order) rules out deadlocks.
--   3. CHECK (on_hand >= 0) is the last line of defence against overselling.
--   4. Prices and totals come only from the products table, never the client.
create function public.create_order_and_reserve_stock(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_pending_orders constant integer := 5;
  c_max_line_quantity  constant integer := 20;
  c_max_line_items     constant integer := 25;
  c_max_order_total    constant bigint  := 99999999; -- Stripe's per-charge limit

  v_user_id       uuid := auth.uid();
  v_email         text;
  v_order_id      uuid := gen_random_uuid();
  v_order_number  bigint;
  v_pending_count integer;
  v_total         bigint := 0;
  v_lines         jsonb := '[]'::jsonb;
  v_item          record;
  v_product       record;
  v_on_hand_after integer;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: Please sign in to check out'
      using errcode = '42501';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_CART: Your cart is empty';
  end if;

  if jsonb_array_length(p_items) > c_max_line_items then
    raise exception 'INVALID_CART: A single order can contain at most % different products',
      c_max_line_items;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;

  perform 1 from public.profiles where id = v_user_id for update;

  select count(*) into v_pending_count
    from public.orders
   where user_id = v_user_id
     and status = 'pending_payment';

  if v_pending_count >= c_max_pending_orders then
    raise exception 'TOO_MANY_PENDING_ORDERS: You have % unpaid orders holding stock. Complete or cancel one from My Orders before starting another checkout',
      v_pending_count;
  end if;

  for v_item in
    select (elem ->> 'product_id')::uuid      as product_id,
           sum((elem ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) as elem
     group by 1
     order by 1
  loop
    if v_item.product_id is null then
      raise exception 'INVALID_CART: Your cart contains an invalid product reference';
    end if;

    if v_item.quantity is null
       or v_item.quantity < 1
       or v_item.quantity > c_max_line_quantity then
      raise exception 'INVALID_QUANTITY: Quantities must be between 1 and % per product',
        c_max_line_quantity;
    end if;

    select p.id, p.name, p.sku, p.price, p.is_active, i.on_hand
      into v_product
      from public.inventory i
      join public.products p on p.id = i.product_id
     where i.product_id = v_item.product_id
       for update of i;

    if not found then
      raise exception 'PRODUCT_UNAVAILABLE: A product in your cart no longer exists';
    end if;

    if not v_product.is_active then
      raise exception 'PRODUCT_UNAVAILABLE: "%" is no longer available', v_product.name;
    end if;

    if v_product.on_hand < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK: Only % of "%" left in stock (you requested %)',
        v_product.on_hand, v_product.name, v_item.quantity;
    end if;

    update public.inventory
       set on_hand = on_hand - v_item.quantity,
           updated_at = now()
     where product_id = v_item.product_id
    returning on_hand into v_on_hand_after;

    insert into public.stock_movements
      (product_id, movement_type, delta, on_hand_after, reason, reference, created_by)
    values
      (v_item.product_id, 'order_reserved', -v_item.quantity, v_on_hand_after,
       'Order checkout reservation', v_order_id::text, v_user_id);

    v_total := v_total + v_product.price::bigint * v_item.quantity;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'name',       v_product.name,
      'sku',        v_product.sku,
      'unit_price', v_product.price,
      'quantity',   v_item.quantity
    );
  end loop;

  if v_total > c_max_order_total then
    raise exception 'ORDER_TOO_LARGE: Order total exceeds the maximum allowed for a single payment';
  end if;

  insert into public.orders (id, user_id, customer_email, total_amount, status_history)
  values (
    v_order_id,
    v_user_id,
    v_email,
    v_total,
    jsonb_build_array(private.history_entry(
      'status_change', 'pending_payment', 'customer',
      'Order created and stock reserved', null, v_user_id))
  )
  returning order_number into v_order_number;

  insert into public.order_items (order_id, product_id, product_name, product_sku, quantity, unit_price)
  select v_order_id, l.product_id, l.name, l.sku, l.quantity, l.unit_price
    from jsonb_to_recordset(v_lines)
      as l(product_id uuid, name text, sku text, quantity integer, unit_price integer);

  return jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total_amount',   v_total,
    'currency',       'gbp',
    'customer_email', v_email,
    'items',          v_lines
  );
end;
$$;

-- Stores the Stripe Checkout Session created server-side. Service role only:
-- the session id is the webhook's lookup key, so clients must not be able to
-- overwrite it.
create function public.attach_checkout_session(
  p_order_id     uuid,
  p_session_id   text,
  p_checkout_url text,
  p_expires_at   timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set stripe_session_id   = p_session_id,
         stripe_checkout_url = p_checkout_url,
         checkout_expires_at = p_expires_at
   where id = p_order_id
     and status = 'pending_payment'
     and (stripe_session_id is null or stripe_session_id = p_session_id);

  if not found then
    raise exception 'ORDER_NOT_PENDING: Order % is not awaiting payment', p_order_id;
  end if;
end;
$$;

-- Lets a customer cancel their own unpaid order (after the server has expired
-- the Stripe session) and is the compensation path when Stripe session
-- creation fails. Releases reserved stock in the same transaction.
create function public.cancel_own_pending_order(
  p_order_id uuid,
  p_reason   text default 'customer_cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order   public.orders%rowtype;
  v_note    text;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: Please sign in' using errcode = '42501';
  end if;

  if p_reason not in ('customer_cancelled', 'checkout_unavailable') then
    raise exception 'INVALID_REASON: Unsupported cancellation reason';
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
     and user_id = v_user_id
     for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: Order not found';
  end if;

  if v_order.status = 'cancelled' then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'changed', false);
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'INVALID_STATUS_TRANSITION: Only unpaid orders can be cancelled (order is %)',
      v_order.status;
  end if;

  v_note := case p_reason
    when 'checkout_unavailable' then 'Payment could not be started; reserved stock released'
    else 'Cancelled by customer before payment; reserved stock released'
  end;

  perform private.set_order_status(
    v_order.id, 'cancelled',
    case p_reason when 'checkout_unavailable' then 'system' else 'customer' end,
    v_note, null, v_user_id);

  perform private.release_order_stock(
    v_order.id, 'order_released',
    case p_reason
      when 'checkout_unavailable' then 'Checkout session could not be created'
      else 'Order cancelled by customer'
    end,
    v_user_id);

  return jsonb_build_object('order_id', v_order.id, 'status', 'cancelled', 'changed', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Stripe webhook processing (service role only)
-- -----------------------------------------------------------------------------

-- One call = one transaction:
--   * The INSERT ... ON CONFLICT DO NOTHING on stripe_events is the
--     idempotency gate. It commits or rolls back together with the order and
--     inventory changes, so an event is never "seen" without being applied,
--     and a replay can never apply twice.
--   * Concurrent deliveries of the same event serialise on the primary key;
--     the loser sees the conflict and becomes a counted duplicate.
--   * State guards (status checks under FOR UPDATE) make different events for
--     the same order (e.g. checkout.session.completed and
--     payment_intent.succeeded) converge on one transition.
--   * `follow_up` is derived from the order's *current* state, not from
--     whether this delivery is new, so a Stripe-side follow-up (expire the
--     session, refund a late payment) that failed is retried on redelivery.
create function public.handle_stripe_webhook_atomic(
  p_event_id          text,
  p_event_type        text,
  p_action            text,
  p_order_id          uuid default null,
  p_stripe_session_id text default null,
  p_payment_intent_id text default null,
  p_amount            integer default null,
  p_currency          text default null,
  p_note              text default null,
  p_payload           jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_id  text;
  v_is_duplicate boolean := false;
  v_order_id     uuid := p_order_id;
  v_order        public.orders%rowtype;
  v_outcome      text;
  v_follow_up    text;
begin
  if p_action not in ('payment_succeeded', 'payment_failed', 'checkout_expired',
                      'refunded', 'partially_refunded') then
    raise exception 'UNSUPPORTED_ACTION: %', p_action;
  end if;

  -- Idempotency gate.
  insert into public.stripe_events (id, event_type, outcome, payload)
  values (p_event_id, p_event_type, 'processing', p_payload)
  on conflict (id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    v_is_duplicate := true;
    update public.stripe_events
       set duplicate_count = duplicate_count + 1,
           last_duplicate_at = now()
     where id = p_event_id;
  end if;

  -- Resolve the order: metadata first, then stored Stripe identifiers.
  if v_order_id is null and p_stripe_session_id is not null then
    select id into v_order_id from public.orders where stripe_session_id = p_stripe_session_id;
  end if;
  if v_order_id is null and p_payment_intent_id is not null then
    select id into v_order_id from public.orders where stripe_payment_intent_id = p_payment_intent_id;
  end if;

  select * into v_order from public.orders where id = v_order_id for update;

  if not found then
    -- e.g. `stripe trigger` fixtures, or events from another environment that
    -- shares the Stripe account. Recorded and acknowledged, never retried.
    if not v_is_duplicate then
      update public.stripe_events set outcome = 'ignored_no_matching_order' where id = p_event_id;
    end if;
    return jsonb_build_object(
      'idempotent_skip', v_is_duplicate,
      'outcome', 'ignored_no_matching_order'
    );
  end if;

  if v_is_duplicate then
    select outcome into v_outcome from public.stripe_events where id = p_event_id;
  else
    case p_action
      when 'payment_succeeded' then
        if v_order.status = 'pending_payment' then
          if (p_amount is not null and p_amount <> v_order.total_amount)
             or (p_currency is not null and lower(p_currency) <> v_order.currency) then
            perform private.add_order_note(v_order.id, 'stripe',
              format('Payment amount mismatch: Stripe reported %s %s but the order total is %s %s. Manual review required.',
                     p_amount, upper(coalesce(p_currency, '?')), v_order.total_amount, upper(v_order.currency)),
              p_event_id);
            v_outcome := 'amount_mismatch_manual_review';
          else
            update public.orders
               set stripe_session_id        = coalesce(stripe_session_id, p_stripe_session_id),
                   stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id)
             where id = v_order.id;
            perform private.set_order_status(v_order.id, 'paid', 'stripe',
              format('Payment confirmed by Stripe (%s)', p_event_type), p_event_id);
            v_outcome := 'order_paid';
          end if;
        elsif v_order.status = 'cancelled' then
          -- Money arrived for an order whose stock was already released.
          if v_order.stripe_payment_intent_id is null then
            update public.orders
               set stripe_payment_intent_id = p_payment_intent_id
             where id = v_order.id;
            perform private.add_order_note(v_order.id, 'stripe',
              'Payment received after the order was cancelled; an automatic full refund is being issued',
              p_event_id);
          end if;
          v_outcome := 'late_payment_refund_required';
        else
          update public.orders
             set stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id)
           where id = v_order.id;
          v_outcome := 'ignored_already_paid';
        end if;

      when 'payment_failed' then
        if v_order.status = 'pending_payment' then
          perform private.add_order_note(v_order.id, 'stripe',
            format('Payment attempt failed (%s). Closing the checkout session to release reserved stock.',
                   coalesce(nullif(btrim(p_note), ''), 'card declined')),
            p_event_id);
          v_outcome := 'payment_failed_session_expiry_requested';
        else
          v_outcome := 'ignored_order_not_pending';
        end if;

      when 'checkout_expired' then
        if v_order.status = 'pending_payment' then
          perform private.set_order_status(v_order.id, 'cancelled', 'stripe',
            'Checkout session expired without payment; reserved stock released', p_event_id);
          perform private.release_order_stock(v_order.id, 'order_released',
            format('Payment failed or checkout session expired (%s)', p_event_type));
          v_outcome := 'order_cancelled_stock_released';
        else
          v_outcome := 'ignored_order_not_pending';
        end if;

      when 'refunded' then
        if v_order.status = 'paid' then
          perform private.set_order_status(v_order.id, 'refunded', 'stripe',
            'Full refund confirmed by Stripe; stock returned to inventory', p_event_id);
          perform private.release_order_stock(v_order.id, 'order_refunded', 'Order refunded via Stripe');
          v_outcome := 'order_refunded_stock_restored';
        elsif v_order.status = 'refunded' then
          v_outcome := 'ignored_already_refunded';
        else
          perform private.add_order_note(v_order.id, 'stripe',
            format('Full refund confirmed by Stripe (order status %s unchanged)', v_order.status),
            p_event_id);
          v_outcome := 'refund_recorded_status_unchanged';
        end if;

      when 'partially_refunded' then
        perform private.add_order_note(v_order.id, 'stripe',
          format('Partial refund recorded in Stripe (%s %s refunded so far); order status unchanged',
                 p_amount, upper(coalesce(p_currency, v_order.currency))),
          p_event_id);
        v_outcome := 'partial_refund_recorded';
    end case;

    update public.stripe_events
       set outcome = v_outcome,
           order_id = v_order.id
     where id = p_event_id;
  end if;

  select * into v_order from public.orders where id = v_order.id;

  v_follow_up := case
    when p_action = 'payment_failed'
         and v_order.status = 'pending_payment'
         and v_order.stripe_session_id is not null
      then 'expire_checkout_session'
    when p_action = 'payment_succeeded'
         and v_order.status = 'cancelled'
         and v_order.stripe_payment_intent_id is not null
         and v_order.stripe_refund_id is null
      then 'refund_late_payment'
  end;

  return jsonb_build_object(
    'idempotent_skip',   v_is_duplicate,
    'outcome',           v_outcome,
    'order_id',          v_order.id,
    'order_status',      v_order.status,
    'follow_up',         v_follow_up,
    'stripe_session_id', v_order.stripe_session_id,
    'payment_intent_id', v_order.stripe_payment_intent_id
  );
end;
$$;

-- Records that a full refund was requested in Stripe (by an admin, or by the
-- webhook handler for a late payment). The status change to 'refunded' is
-- left to the charge.refunded webhook.
create function public.record_order_refund_request(
  p_order_id  uuid,
  p_refund_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_order      public.orders%rowtype;
begin
  if not (v_is_service or public.is_admin()) then
    raise exception 'FORBIDDEN: Admin role required' using errcode = '42501';
  end if;

  if p_refund_id is null or p_refund_id !~ '^re_' then
    raise exception 'INVALID_REFUND: A Stripe refund id is required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND: Order not found';
  end if;

  if v_order.stripe_refund_id = p_refund_id then
    return jsonb_build_object('order_id', v_order.id, 'changed', false);
  end if;

  if v_order.status not in ('paid', 'cancelled', 'refunded') then
    raise exception 'INVALID_STATUS_TRANSITION: Order in status % cannot be refunded', v_order.status;
  end if;

  update public.orders set stripe_refund_id = p_refund_id where id = v_order.id;

  perform private.add_order_note(
    v_order.id,
    case when v_is_service then 'system' else 'admin' end,
    format('Full refund requested in Stripe (%s); awaiting Stripe confirmation', p_refund_id),
    null,
    case when v_is_service then null else auth.uid() end);

  return jsonb_build_object('order_id', v_order.id, 'changed', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Admin operations
-- -----------------------------------------------------------------------------

create function public.admin_transition_order_status(
  p_order_id   uuid,
  p_new_status public.order_status,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_order    public.orders%rowtype;
  v_note     text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: Admin role required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND: Order not found';
  end if;

  if v_order.status = p_new_status then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'changed', false);
  end if;

  if p_new_status = 'paid' then
    raise exception 'INVALID_STATUS_TRANSITION: Orders can only be marked paid by a verified Stripe webhook';
  end if;

  if p_new_status = 'refunded' then
    raise exception 'INVALID_STATUS_TRANSITION: Issue a refund through Stripe; the refund webhook updates the status';
  end if;

  if not (
       (v_order.status = 'pending_payment' and p_new_status = 'cancelled')
    or (v_order.status = 'paid'            and p_new_status = 'fulfilled')
  ) then
    raise exception 'INVALID_STATUS_TRANSITION: Cannot transition order from % to %',
      v_order.status, p_new_status;
  end if;

  if p_new_status = 'fulfilled' and v_order.stripe_refund_id is not null then
    raise exception 'REFUND_PENDING: A refund has been requested for this order; it cannot be fulfilled';
  end if;

  perform private.set_order_status(
    v_order.id, p_new_status, 'admin',
    coalesce(v_note, case p_new_status
      when 'fulfilled' then 'Marked as fulfilled by admin'
      else 'Cancelled by admin; reserved stock released'
    end),
    null, v_admin_id);

  if p_new_status = 'cancelled' then
    perform private.release_order_stock(v_order.id, 'order_released', 'Order cancelled by admin', v_admin_id);
  end if;

  return jsonb_build_object('order_id', v_order.id, 'status', p_new_status, 'changed', true);
end;
$$;

create function public.admin_adjust_stock(
  p_product_id uuid,
  p_delta      integer,
  p_reason     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_on_hand  integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: Admin role required' using errcode = '42501';
  end if;

  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'INVALID_ADJUSTMENT: Adjustment must be a non-zero whole number up to 100000';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then
    raise exception 'INVALID_ADJUSTMENT: A reason of 3–200 characters is required';
  end if;

  select on_hand into v_on_hand
    from public.inventory
   where product_id = p_product_id
     for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND: Product not found';
  end if;

  if v_on_hand + p_delta < 0 then
    raise exception 'INSUFFICIENT_STOCK_FOR_ADJUSTMENT: Cannot remove % units; only % on hand',
      abs(p_delta), v_on_hand;
  end if;

  update public.inventory
     set on_hand = on_hand + p_delta,
         updated_at = now()
   where product_id = p_product_id
  returning on_hand into v_on_hand;

  insert into public.stock_movements
    (product_id, movement_type, delta, on_hand_after, reason, reference, created_by)
  values
    (p_product_id, 'manual_adjustment', p_delta, v_on_hand, v_reason,
     'manual_admin_adjustment', v_admin_id);

  return jsonb_build_object('product_id', p_product_id, 'on_hand', v_on_hand);
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Privileges
-- -----------------------------------------------------------------------------

-- Tables: start from nothing, then grant the minimum. RLS narrows rows further.
revoke all on table
  public.profiles, public.products, public.inventory, public.stock_movements,
  public.orders, public.order_items, public.stripe_events
from anon, authenticated;

grant select on public.products to anon, authenticated;
grant insert (sku, name, description, price, image_url, is_active, available_stock)
  on public.products to authenticated;
-- available_stock is deliberately absent: it only changes via the inventory mirror.
grant update (sku, name, description, price, image_url, is_active)
  on public.products to authenticated;

grant select on public.profiles to authenticated;
-- role and email are deliberately absent: no self-service privilege escalation.
grant update (display_name) on public.profiles to authenticated;

grant select on public.inventory, public.stock_movements, public.orders,
                public.order_items, public.stripe_events
  to authenticated;

-- The stock ledger is append-only, even for the service-role key.
revoke update, delete, truncate on public.stock_movements from service_role;

-- Functions: Postgres grants EXECUTE to PUBLIC by default and Supabase exposes
-- public functions over /rpc, so every function gets an explicit allow-list.
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;

grant execute on function public.create_order_and_reserve_stock(jsonb) to authenticated;
grant execute on function public.cancel_own_pending_order(uuid, text) to authenticated;
grant execute on function public.admin_transition_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_adjust_stock(uuid, integer, text) to authenticated;
grant execute on function public.record_order_refund_request(uuid, text) to authenticated, service_role;

grant execute on function public.attach_checkout_session(uuid, text, text, timestamptz) to service_role;
grant execute on function public.handle_stripe_webhook_atomic(
  text, text, text, uuid, text, text, integer, text, text, jsonb
) to service_role;

-- -----------------------------------------------------------------------------
-- 11. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.inventory       enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.stripe_events   enable row level security;

-- profiles: own row, or everything for admins. Updates are limited to
-- display_name by the column grant above.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- products: the public sees the active catalogue; admins see and manage all.
-- No DELETE policy: products referenced by orders are deactivated, not deleted.
create policy products_select_public on public.products
  for select to anon
  using (is_active);

create policy products_select_authenticated on public.products
  for select to authenticated
  using (is_active or (select public.is_admin()));

create policy products_insert_admin on public.products
  for insert to authenticated
  with check ((select public.is_admin()));

create policy products_update_admin on public.products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- inventory / stock ledger / webhook ledger: admin read-only. All writes go
-- through the SECURITY DEFINER functions so every change is ledgered.
create policy inventory_select_admin on public.inventory
  for select to authenticated
  using ((select public.is_admin()));

create policy stock_movements_select_admin on public.stock_movements
  for select to authenticated
  using ((select public.is_admin()));

create policy stripe_events_select_admin on public.stripe_events
  for select to authenticated
  using ((select public.is_admin()));

-- orders: customers see their own; admins see all. No direct writes.
create policy orders_select on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy order_items_select on public.order_items
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
        from public.orders o
       where o.id = order_items.order_id
         and o.user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 12. Storage: product images
-- -----------------------------------------------------------------------------

-- SVG is excluded on purpose: it can carry script and would be served from the
-- storage origin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;

create policy product_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy product_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
