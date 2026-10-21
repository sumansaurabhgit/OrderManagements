-- =============================================================================
-- Local seed data — applied automatically by `npx supabase db reset`.
--
-- Test accounts (password for both: Password123!)
--   admin@example.com     role = admin
--   customer@example.com  role = customer
--
-- For hosted environments use `npm run seed:users` instead of inserting into
-- auth.users directly (see README).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Test users. Token columns must be '' (not NULL) or GoTrue fails to load them.
-- The on_auth_user_created trigger creates each profile as a customer.
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'admin@example.com',
   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Store Admin"}', now(), now(),
   '', '', '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'customer@example.com',
   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Casey Customer"}', now(), now(),
   '', '', '', '', '', '', '', '', false, false);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.id in ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');

-- Role promotion is a privileged, out-of-band operation (never self-service).
update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';

-- -----------------------------------------------------------------------------
-- Catalogue. Inserting available_stock fires products_init_inventory, which
-- creates the inventory row and an 'initial_stock' ledger entry.
-- -----------------------------------------------------------------------------
insert into public.products (sku, name, description, price, image_url, is_active, available_stock)
values
  ('LG-MUG-001', 'Stoneware Coffee Mug',
   'A generous 350 ml mug, wheel-thrown in speckled stoneware and finished in a satin oat glaze. Dishwasher and microwave safe.',
   1800, '/images/products/stoneware-mug.svg', true, 24),
  ('LG-DRIP-002', 'Ceramic Pour-Over Dripper',
   'Single-cup pour-over cone with spiral ribs for an even extraction. Fits standard #2 filters and most mugs.',
   2999, '/images/products/pour-over-dripper.svg', true, 12),
  ('LG-BTL-003', 'Insulated Steel Bottle 750 ml',
   'Double-walled stainless steel keeps drinks cold for 24 hours or hot for 12. Leak-proof bamboo cap.',
   2450, '/images/products/steel-bottle.svg', true, 40),
  ('LG-BEAN-004', 'Merino Wool Beanie',
   'Rib-knit from soft, non-itch merino wool. Naturally temperature-regulating and odour-resistant.',
   3200, '/images/products/merino-beanie.svg', true, 8),
  ('LG-ORG-005', 'Walnut Desk Organiser',
   'Solid American walnut tray with three compartments for pens, cards and cables. Last one in stock — use it to test concurrent checkout.',
   6400, '/images/products/walnut-organiser.svg', true, 1),
  ('LG-TOWEL-006', 'Linen Tea Towel Set (3)',
   'Three stonewashed European linen tea towels in natural, sage and clay. Highly absorbent and lint-free.',
   2100, '/images/products/linen-towels.svg', true, 0),
  ('LG-NOTE-007', 'Dot Grid Notebook A5',
   '160 pages of 100 gsm fountain-pen-friendly paper with a lay-flat binding and numbered pages.',
   1250, '/images/products/dot-notebook.svg', true, 60),
  ('LG-LAMP-008', 'Brass Reading Lamp',
   'Adjustable brass desk lamp with a weighted base. Currently inactive: visible to admins only.',
   8900, '/images/products/brass-lamp.svg', false, 5);
