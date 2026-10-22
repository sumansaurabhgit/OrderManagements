-- Lets a customer release a checkout reservation immediately when they leave
-- Stripe or change the cart. The expiry webhook still owns truly abandoned
-- sessions; this reason is only the explicit path. A second call, or a later
-- checkout.session.expired delivery, finds the order already cancelled and
-- does not move stock again.

create or replace function public.cancel_own_pending_order(
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
  v_stock_reason text;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: Please sign in' using errcode = '42501';
  end if;

  if p_reason not in ('customer_cancelled', 'checkout_unavailable', 'checkout_abandoned') then
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
    when 'checkout_abandoned' then 'Customer cancelled checkout / modified cart'
    else 'Cancelled by customer before payment; reserved stock released'
  end;

  v_stock_reason := case p_reason
    when 'checkout_unavailable' then 'Checkout session could not be created'
    when 'checkout_abandoned' then 'Customer cancelled checkout / modified cart'
    else 'Order cancelled by customer'
  end;

  perform private.set_order_status(
    v_order.id, 'cancelled',
    case p_reason when 'checkout_unavailable' then 'system' else 'customer' end,
    v_note, null, v_user_id);

  perform private.release_order_stock(
    v_order.id, 'order_released', v_stock_reason, v_user_id);

  return jsonb_build_object('order_id', v_order.id, 'status', 'cancelled', 'changed', true);
end;
$$;
