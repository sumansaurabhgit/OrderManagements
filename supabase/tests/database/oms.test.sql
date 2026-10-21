-- =============================================================================
-- Database tests: RLS boundaries, stock reservation, state machine, webhook
-- idempotency. Run with `npx supabase test db`.
--
-- Requires the seeded test users and products (supabase/seed.sql), but not a
-- pristine database: fixtures are captured and stock levels are set (through
-- the ledgered admin function) at the start. Everything runs in one
-- transaction and is rolled back.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

-- -----------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- -----------------------------------------------------------------------------
select set_config('test.customer', 'c0000000-0000-4000-8000-000000000002', true);
select set_config('test.admin', 'a0000000-0000-4000-8000-000000000001', true);
select set_config('test.last_unit_id',   (select id::text from public.products where sku = 'LG-ORG-005'), true);
select set_config('test.sold_out_id',    (select id::text from public.products where sku = 'LG-TOWEL-006'), true);
select set_config('test.inactive_id',    (select id::text from public.products where sku = 'LG-LAMP-008'), true);
select set_config('test.mug_id',         (select id::text from public.products where sku = 'LG-MUG-001'), true);
select set_config('test.product_count',  (select count(*)::text from public.products), true);

-- Clear the customer's unpaid orders so the pending-order cap cannot interfere.
update public.orders
   set status = 'cancelled'
 where user_id = current_setting('test.customer')::uuid
   and status = 'pending_payment';

-- Known stock levels, set through the ledgered admin function.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);
select public.admin_adjust_stock(product_id, 1 - on_hand, 'Test setup')
  from public.inventory where product_id = current_setting('test.last_unit_id')::uuid and on_hand <> 1;
select public.admin_adjust_stock(product_id, -on_hand, 'Test setup')
  from public.inventory where product_id = current_setting('test.sold_out_id')::uuid and on_hand <> 0;
select public.admin_adjust_stock(product_id, 10, 'Test setup')
  from public.inventory where product_id = current_setting('test.mug_id')::uuid and on_hand < 10;
select set_config('test.mug_on_hand',
  (select on_hand::text from public.inventory where product_id = current_setting('test.mug_id')::uuid), true);
reset role;

-- -----------------------------------------------------------------------------
-- Structural guarantees
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS is enabled on every table in the public schema'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')),
  array['is_admin'],
  'anon can execute only is_admin() over RPC'
);

select ok(
  not has_function_privilege('authenticated',
    'public.handle_stripe_webhook_atomic(text,text,text,uuid,text,text,integer,text,text,jsonb)', 'execute'),
  'authenticated users cannot call the webhook processor'
);

select ok(
  not has_function_privilege('authenticated',
    'public.attach_checkout_session(uuid,text,text,timestamptz)', 'execute'),
  'authenticated users cannot attach Stripe sessions'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'the private helper schema is not reachable by API roles'
);

-- -----------------------------------------------------------------------------
-- Anonymous visitor
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok((select count(*) from public.products) > 0, 'anon can browse the catalogue');
select is((select count(*)::int from public.products where not is_active), 0, 'anon sees no inactive products');
select throws_ok('select * from public.inventory',       '42501', null, 'anon cannot read inventory');
select throws_ok('select * from public.stock_movements', '42501', null, 'anon cannot read the stock ledger');
select throws_ok('select * from public.orders',          '42501', null, 'anon cannot read orders');
select throws_ok('select * from public.profiles',        '42501', null, 'anon cannot read profiles');

reset role;

-- -----------------------------------------------------------------------------
-- Customer
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.customer'), 'role', 'authenticated')::text, true);

select is((select count(*)::int from public.products where not is_active), 0, 'customer sees no inactive products');
select is((select count(*)::int from public.inventory), 0, 'customer sees no inventory rows');
select is((select count(*)::int from public.stock_movements), 0, 'customer sees no stock movements');
select is((select count(*)::int from public.stripe_events), 0, 'customer sees no webhook events');
select is((select count(*)::int from public.profiles), 1, 'customer sees only their own profile');

select throws_ok(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501', null, 'customer cannot escalate their own role');

select lives_ok(
  $$update public.profiles set display_name = 'Casey C.' where id = auth.uid()$$,
  'customer can update their display name');

select throws_ok(
  $$insert into public.orders (user_id, customer_email, total_amount) values (auth.uid(), 'x@example.com', 1)$$,
  '42501', null, 'customer cannot insert orders directly');

select throws_ok(
  $$select public.admin_adjust_stock(current_setting('test.mug_id')::uuid, 5, 'Free stock')$$,
  '42501', null, 'customer cannot adjust stock');

select lives_ok(
  $$select set_config('test.order_id', public.create_order_and_reserve_stock(jsonb_build_array(jsonb_build_object(
      'product_id', current_setting('test.last_unit_id')::uuid, 'quantity', 1))) ->> 'order_id', true)$$,
  'customer can reserve the last unit of a product');

select throws_matching(
  $$select public.create_order_and_reserve_stock(jsonb_build_array(jsonb_build_object(
      'product_id', current_setting('test.last_unit_id')::uuid, 'quantity', 1)))$$,
  '^INSUFFICIENT_STOCK',
  'a second purchase of the last unit is rejected (no overselling)');

select throws_matching(
  $$select public.create_order_and_reserve_stock(jsonb_build_array(jsonb_build_object(
      'product_id', current_setting('test.sold_out_id')::uuid, 'quantity', 1)))$$,
  '^INSUFFICIENT_STOCK',
  'out-of-stock products cannot be purchased');

select throws_matching(
  $$select public.create_order_and_reserve_stock(jsonb_build_array(jsonb_build_object(
      'product_id', current_setting('test.inactive_id')::uuid, 'quantity', 1)))$$,
  '^PRODUCT_UNAVAILABLE',
  'inactive products cannot be purchased');

select is((select available_stock from public.products where id = current_setting('test.last_unit_id')::uuid), 0,
  'the public availability mirror reflects the reservation');

select ok(exists(select 1 from public.orders where id = current_setting('test.order_id')::uuid),
  'customer can read their own order');
select is((select count(*)::int from public.orders where user_id <> auth.uid()), 0,
  'customer cannot read other users'' orders');

select is(
  (select total_amount from public.orders where id = current_setting('test.order_id')::uuid),
  (select price from public.products where id = current_setting('test.last_unit_id')::uuid),
  'order total is computed from the database price');

select throws_ok(
  $$update public.orders set status = 'paid' where id = current_setting('test.order_id')::uuid$$,
  '42501', null, 'customer cannot mark their own order paid');

reset role;

-- -----------------------------------------------------------------------------
-- Admin
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);

select is((select count(*)::int from public.products), current_setting('test.product_count')::int,
  'admin sees every product, including inactive ones');
select is((select count(*)::int from public.inventory), current_setting('test.product_count')::int,
  'admin can read inventory');

select throws_ok(
  $$update public.inventory set on_hand = 999$$,
  '42501', null, 'admin cannot bypass the stock ledger with a direct update');

select throws_matching(
  $$select public.admin_transition_order_status(current_setting('test.order_id')::uuid, 'fulfilled')$$,
  '^INVALID_STATUS_TRANSITION', 'pending_payment -> fulfilled is rejected');

select throws_matching(
  $$select public.admin_transition_order_status(current_setting('test.order_id')::uuid, 'paid')$$,
  '^INVALID_STATUS_TRANSITION', 'admins cannot mark an order paid');

select throws_matching(
  $$select public.admin_adjust_stock(current_setting('test.sold_out_id')::uuid, -1, 'Damaged in transit')$$,
  '^INSUFFICIENT_STOCK_FOR_ADJUSTMENT', 'stock adjustments cannot go negative');

select is(
  (public.admin_adjust_stock(current_setting('test.mug_id')::uuid, 6, 'Supplier delivery') ->> 'on_hand')::int,
  current_setting('test.mug_on_hand')::int + 6,
  'admin stock adjustment updates on_hand');

reset role;

-- -----------------------------------------------------------------------------
-- Stripe webhook processing (service role)
-- -----------------------------------------------------------------------------
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('test.order_total',
  (select total_amount::text from public.orders where id = current_setting('test.order_id')::uuid), true);

select is(
  public.handle_stripe_webhook_atomic('evt_test_paid_1', 'checkout.session.completed', 'payment_succeeded',
    current_setting('test.order_id')::uuid, 'cs_test_1', 'pi_test_1', current_setting('test.order_total')::int, 'gbp') ->> 'outcome',
  'order_paid', 'checkout.session.completed marks the order paid');

select is(
  public.handle_stripe_webhook_atomic('evt_test_paid_1', 'checkout.session.completed', 'payment_succeeded',
    current_setting('test.order_id')::uuid, 'cs_test_1', 'pi_test_1', current_setting('test.order_total')::int, 'gbp') ->> 'idempotent_skip',
  'true', 'replaying the same event is skipped');

select is((select duplicate_count from public.stripe_events where id = 'evt_test_paid_1'), 1,
  'the replay is counted as a duplicate');

select is(
  (select jsonb_array_length(status_history) from public.orders where id = current_setting('test.order_id')::uuid), 2,
  'the replay did not append a second status entry');

select is(
  public.handle_stripe_webhook_atomic('evt_test_pi_1', 'payment_intent.succeeded', 'payment_succeeded',
    current_setting('test.order_id')::uuid, null, 'pi_test_1', current_setting('test.order_total')::int, 'gbp') ->> 'outcome',
  'ignored_already_paid', 'a second success event for the same payment is a no-op');

select is(
  public.handle_stripe_webhook_atomic('evt_test_unknown', 'checkout.session.completed', 'payment_succeeded',
    null, 'cs_does_not_exist', null, 100, 'gbp') ->> 'outcome',
  'ignored_no_matching_order', 'events for unknown orders are acknowledged and ignored');

select is(
  public.handle_stripe_webhook_atomic('evt_test_refund_1', 'charge.refunded', 'refunded',
    null, null, 'pi_test_1', current_setting('test.order_total')::int, 'gbp') ->> 'outcome',
  'order_refunded_stock_restored', 'charge.refunded marks the order refunded');

select is((select available_stock from public.products where id = current_setting('test.last_unit_id')::uuid), 1,
  'the refund returned the unit to stock');

reset role;

-- Expiry path: a new reservation is released when the session expires.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.customer'), 'role', 'authenticated')::text, true);
select set_config('test.order2_id', public.create_order_and_reserve_stock(jsonb_build_array(jsonb_build_object(
  'product_id', current_setting('test.mug_id')::uuid, 'quantity', 3))) ->> 'order_id', true);
reset role;

select is((select available_stock from public.products where id = current_setting('test.mug_id')::uuid),
  current_setting('test.mug_on_hand')::int + 6 - 3,
  'a second order reserved three mugs');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  public.handle_stripe_webhook_atomic('evt_test_failed_1', 'payment_intent.payment_failed', 'payment_failed',
    current_setting('test.order2_id')::uuid, null, 'pi_test_2', null, null, 'Your card was declined.') ->> 'outcome',
  'payment_failed_session_expiry_requested', 'a declined card requests session expiry instead of cancelling directly');

select is(
  public.handle_stripe_webhook_atomic('evt_test_expired_1', 'checkout.session.expired', 'checkout_expired',
    current_setting('test.order2_id')::uuid) ->> 'outcome',
  'order_cancelled_stock_released', 'checkout.session.expired cancels the order');

reset role;

select is((select available_stock from public.products where id = current_setting('test.mug_id')::uuid),
  current_setting('test.mug_on_hand')::int + 6,
  'expiry released the reserved mugs');

-- -----------------------------------------------------------------------------
-- Invariants that hold for every writer
-- -----------------------------------------------------------------------------
select throws_matching(
  $$update public.orders set status = 'paid' where id = current_setting('test.order_id')::uuid$$,
  '^INVALID_STATUS_TRANSITION', 'the state machine is enforced even for the database owner');

select is(
  (select count(*)::int
     from public.inventory i
    where i.on_hand <> (select coalesce(sum(m.delta), 0)
                          from public.stock_movements m
                         where m.product_id = i.product_id)),
  0, 'for every product, on_hand equals the sum of its ledger deltas');

select * from finish();
rollback;
