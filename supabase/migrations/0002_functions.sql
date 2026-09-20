-- =====================================================================
-- VELOX EXPRESS — functions, triggers, views
-- =====================================================================

-- ---------- is_admin -------------------------------------------------
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins
    where id = auth.uid() and is_active = true
  );
$$;

-- ---------- order code: VLX-YYMMDD-0001 ------------------------------
create or replace function next_order_code()
returns text language plpgsql as $$
declare
  n bigint;
begin
  n := nextval('order_code_seq');
  return 'VLX-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD')
         || '-' || lpad((n % 10000)::text, 4, '0');
end $$;

-- ---------- delivery OTP ---------------------------------------------
create or replace function generate_delivery_otp()
returns text language sql volatile as $$
  select lpad((floor(random() * 10000))::int::text, 4, '0');
$$;

-- ---------- opaque rider token ---------------------------------------
create or replace function generate_rider_token()
returns text language sql volatile as $$
  select encode(gen_random_bytes(24), 'hex');
$$;

-- ---------- status history is written by trigger, never by hand ------
create or replace function log_order_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into order_status_history (order_id, status, actor_type, note)
    values (new.id, new.status, 'system', 'Order created');
  elsif new.status is distinct from old.status then
    insert into order_status_history (order_id, status, actor_type)
    values (new.id, new.status, coalesce(current_setting('app.actor_type', true), 'system'));
  end if;
  return new;
end $$;

create trigger t_orders_status_history
  after insert or update of status on orders
  for each row execute function log_order_status();

-- =====================================================================
-- ATOMIC CLAIM
--
-- This is the whole concurrency mechanism. One conditional UPDATE.
-- Returns the order row on success, zero rows if somebody already
-- claimed it. Works identically whether the caller is the admin
-- dispatch UI or a future WhatsApp webhook handling N riders racing.
-- =====================================================================
create or replace function claim_order(p_order_id uuid, p_rider_id uuid)
returns table (
  order_id    uuid,
  order_code  text,
  rider_id    uuid,
  rider_token text,
  claimed     boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_token text := generate_rider_token();
begin
  -- Reject riders who cannot take work, before racing for the row.
  if not exists (
    select 1 from riders r
    where r.id = p_rider_id and r.is_active = true
  ) then
    raise exception 'Rider is not active' using errcode = 'check_violation';
  end if;

  return query
  with claimed_row as (
    update orders o
       set rider_id    = p_rider_id,
           rider_token = v_token,
           assigned_at = now(),
           status      = 'rider_assigned'
     where o.id = p_order_id
       and o.rider_id is null                    -- <= first writer wins
       and o.status in ('order_placed', 'confirmed', 'finding_rider')
    returning o.id, o.code, o.rider_id, o.rider_token
  )
  select c.id, c.code, c.rider_id, c.rider_token, true from claimed_row c;

  -- No rows updated: the order was already taken or is past assignment.
  if not found then
    return query select p_order_id, null::text, null::uuid, null::text, false;
  end if;
end $$;

comment on function claim_order is
  'First-accept-wins. The WHERE rider_id IS NULL clause is the lock; '
  'do not add application-level locking around it.';

-- ---------- release an assignment (admin only path) ------------------
create or replace function release_order(p_order_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update orders
     set rider_id = null, rider_token = null, assigned_at = null,
         status = 'finding_rider'
   where id = p_order_id
     and status in ('rider_assigned', 'picked_up');
  return found;
end $$;

-- =====================================================================
-- RIDER TOKEN ACTIONS — called only by the rider Edge Function with the
-- service role. Token validity is enforced here, not in the client.
-- =====================================================================
create or replace function rider_order_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'code', o.code,
    'status', o.status,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'pickup_address', o.pickup_address,
    'pickup_landmark', o.pickup_landmark,
    'pickup_area', pa.name,
    'receiver_name', o.receiver_name,
    'receiver_phone', o.receiver_phone,
    'delivery_address', o.delivery_address,
    'delivery_landmark', o.delivery_landmark,
    'delivery_area', da.name,
    'parcel_type', o.parcel_type,
    'weight_kg', o.weight_kg,
    'is_fragile', o.is_fragile,
    'parcel_description', o.parcel_description,
    'distance_km', o.distance_km,
    'total_amount', o.total_amount,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'scheduled_date', o.scheduled_date,
    'rider_name', r.name
  )
  into result
  from orders o
  left join service_areas pa on pa.id = o.pickup_area_id
  left join service_areas da on da.id = o.delivery_area_id
  left join riders r on r.id = o.rider_id
  where o.rider_token = p_token
    and o.status in ('rider_assigned', 'picked_up', 'out_for_delivery');

  return result;  -- null when the token is unknown, spent, or cancelled
end $$;

create or replace function rider_advance_status(
  p_token text,
  p_next  order_status,
  p_otp   text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where rider_token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- Only forward transitions the rider is allowed to make.
  if not (
    (v_order.status = 'rider_assigned'   and p_next = 'picked_up') or
    (v_order.status = 'picked_up'        and p_next = 'out_for_delivery') or
    (v_order.status = 'out_for_delivery' and p_next = 'delivered')
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_transition');
  end if;

  if p_next = 'delivered' then
    if p_otp is null or p_otp <> v_order.delivery_otp then
      return jsonb_build_object('ok', false, 'error', 'invalid_otp');
    end if;
  end if;

  perform set_config('app.actor_type', 'rider', true);

  update orders
     set status       = p_next,
         picked_up_at = case when p_next = 'picked_up' then now() else picked_up_at end,
         delivered_at = case when p_next = 'delivered' then now() else delivered_at end,
         -- token dies with the delivery
         rider_token  = case when p_next = 'delivered' then null else rider_token end
   where id = v_order.id;

  -- Free the rider up again once the job is done.
  if p_next = 'delivered' and v_order.rider_id is not null then
    update riders set availability = 'available' where id = v_order.rider_id;
  end if;

  return jsonb_build_object('ok', true, 'status', p_next);
end $$;

-- =====================================================================
-- CUSTOMER TRACKING — narrow projection, Order ID + phone required.
-- Deliberately returns no internal notes, no rider phone, no margins.
-- =====================================================================
create or replace function track_order(p_code text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_history jsonb;
begin
  select * into v_order
  from orders
  where upper(code) = upper(trim(p_code))
    and regexp_replace(customer_phone, '\D', '', 'g')
        = regexp_replace(p_phone, '\D', '', 'g');

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('status', h.status, 'at', h.created_at)
           order by h.created_at
         ), '[]'::jsonb)
  into v_history
  from order_status_history h
  where h.order_id = v_order.id;

  return jsonb_build_object(
    'code', v_order.code,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'scheduled_date', v_order.scheduled_date,
    'pickup_area', (select name from service_areas where id = v_order.pickup_area_id),
    'delivery_area', (select name from service_areas where id = v_order.delivery_area_id),
    'receiver_name', v_order.receiver_name,
    'parcel_type', v_order.parcel_type,
    'weight_kg', v_order.weight_kg,
    'total_amount', v_order.total_amount,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'delivery_otp', case
      when v_order.status in ('out_for_delivery', 'picked_up') then v_order.delivery_otp
      else null end,
    'rider_name', (select name from riders where id = v_order.rider_id),
    'history', v_history
  );
end $$;

-- =====================================================================
-- ANALYTICS — every figure below is derived from recorded rows.
-- Revenue counts an order only when it is delivered AND its payment is
-- verified, and it reads the frozen snapshot amount.
-- =====================================================================
create or replace view revenue_orders as
  select
    o.id,
    o.code,
    o.created_at,
    o.delivered_at,
    coalesce(o.delivered_at, o.created_at)::date as recognised_on,
    o.total_amount,
    o.customer_type,
    o.pickup_area_id,
    o.delivery_area_id,
    o.rider_id,
    o.parcel_type
  from orders o
  where o.status = 'delivered'
    and o.payment_status = 'verified';

comment on view revenue_orders is
  'Recognised revenue only: delivered and payment-verified. Anything else is '
  'pipeline, not revenue, and must be labelled as such in the UI.';

create or replace function analytics_summary(p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with rev as (
    select coalesce(sum(total_amount), 0) amount, count(*) cnt
    from revenue_orders
    where recognised_on between p_from and p_to
  ),
  exp as (
    select coalesce(sum(amount), 0) amount
    from expenses where spent_on between p_from and p_to
  ),
  ord as (
    select
      count(*) total,
      count(*) filter (where status = 'delivered') delivered,
      count(*) filter (where status = 'cancelled') cancelled,
      count(*) filter (where status not in ('delivered', 'cancelled')) in_progress,
      coalesce(sum(total_amount) filter (where payment_status <> 'verified'
        and status <> 'cancelled'), 0) outstanding
    from orders
    where created_at::date between p_from and p_to
  ),
  people as (
    select
      (select count(*) from riders where is_active) active_riders,
      (select count(*) from customers) customers
  )
  select jsonb_build_object(
    'revenue', rev.amount,
    'expenses', exp.amount,
    'net_profit', rev.amount - exp.amount,
    'revenue_order_count', rev.cnt,
    'avg_order_value', case when rev.cnt > 0 then round(rev.amount / rev.cnt, 2) else 0 end,
    'total_orders', ord.total,
    'delivered_orders', ord.delivered,
    'cancelled_orders', ord.cancelled,
    'in_progress_orders', ord.in_progress,
    'pending_payment_amount', ord.outstanding,
    'active_riders', people.active_riders,
    'customers', people.customers,
    'from', p_from,
    'to', p_to
  )
  from rev, exp, ord, people;
$$;

-- Daily series for the revenue/expense/profit chart.
create or replace function analytics_daily(p_from date, p_to date)
returns table (day date, revenue numeric, expenses numeric, orders bigint)
language sql stable security definer set search_path = public as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  )
  select
    d.day,
    coalesce((select sum(total_amount) from revenue_orders r
              where r.recognised_on = d.day), 0),
    coalesce((select sum(amount) from expenses e where e.spent_on = d.day), 0),
    (select count(*) from orders o where o.created_at::date = d.day)
  from days d
  order by d.day;
$$;
