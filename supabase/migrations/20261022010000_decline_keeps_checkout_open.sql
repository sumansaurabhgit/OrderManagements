-- A declined card must not expire the Checkout Session. Expiring it while the
-- customer is still on Stripe's page replaces the decline with "You're all
-- done here" and removes the back link. The attempt is recorded; stock is
-- released later by checkout.session.expired or by an explicit cancellation.

create or replace function public.handle_stripe_webhook_atomic(
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

  if v_order_id is null and p_stripe_session_id is not null then
    select id into v_order_id from public.orders where stripe_session_id = p_stripe_session_id;
  end if;
  if v_order_id is null and p_payment_intent_id is not null then
    select id into v_order_id from public.orders where stripe_payment_intent_id = p_payment_intent_id;
  end if;

  select * into v_order from public.orders where id = v_order_id for update;

  if not found then
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
            format('Payment attempt failed (%s). The checkout session stays open so another card can be tried.',
                   coalesce(nullif(btrim(p_note), ''), 'card declined')),
            p_event_id);
          v_outcome := 'payment_failed_recorded';
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
