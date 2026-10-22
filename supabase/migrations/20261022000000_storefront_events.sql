-- Live storefront events. A trigger records catalogue changes; signed-in
-- clients hear about them through the app's server-sent-event stream.
-- Clients cannot insert rows: only the trigger (table owner) writes.

create table public.storefront_events (
  id         bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'product.created',
    'product.updated',
    'product.removed',
    'stock.updated'
  )),
  message    text not null check (char_length(message) between 1 and 200),
  product_id uuid references public.products (id) on delete set null,
  created_at timestamptz not null default now()
);

revoke all on table public.storefront_events from anon, authenticated;
grant select on public.storefront_events to authenticated;

alter table public.storefront_events enable row level security;

create policy storefront_events_select_authenticated
  on public.storefront_events
  for select
  to authenticated
  using (true);

create function private.record_storefront_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type    text;
  v_message text;
begin
  if tg_op = 'INSERT' then
    if not new.is_active then
      return new;
    end if;
    v_type := 'product.created';
    v_message := format('A new product was added: %s', new.name);
  elsif not old.is_active and new.is_active then
    v_type := 'product.created';
    v_message := format('A new product was added: %s', new.name);
  elsif old.is_active and not new.is_active then
    v_type := 'product.removed';
    v_message := format('%s was removed from the shop', new.name);
  elsif new.is_active
    and old.name is not distinct from new.name
    and old.sku is not distinct from new.sku
    and old.price is not distinct from new.price
    and old.description is not distinct from new.description
    and old.image_url is not distinct from new.image_url
    and old.available_stock is distinct from new.available_stock then
    v_type := 'stock.updated';
    v_message := format('Stock updated for %s', new.name);
  elsif new.is_active
    and (
      old.name is distinct from new.name
      or old.sku is distinct from new.sku
      or old.price is distinct from new.price
      or old.description is distinct from new.description
      or old.image_url is distinct from new.image_url
      or old.available_stock is distinct from new.available_stock
    ) then
    v_type := 'product.updated';
    v_message := format('%s was updated', new.name);
  else
    return new;
  end if;

  insert into public.storefront_events (event_type, message, product_id)
  values (v_type, left(v_message, 200), new.id);

  return new;
end;
$$;

create trigger products_record_storefront_event
  after insert or update on public.products
  for each row execute function private.record_storefront_event();

revoke execute on function private.record_storefront_event() from public, anon, authenticated;
