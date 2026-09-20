-- =====================================================================
-- VELOX EXPRESS — core schema
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------- enums ----------------------------------------------------
create type order_status as enum (
  'order_placed',
  'confirmed',
  'finding_rider',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

create type payment_status as enum (
  'pending',
  'submitted',
  'verified',
  'failed',
  'refunded'
);

create type payment_method as enum ('upi', 'cash', 'pay_later', 'gateway');
create type customer_type as enum ('individual', 'business');
create type discount_type as enum ('percentage', 'flat');
create type rider_availability as enum ('available', 'busy', 'off_duty');
create type expense_category as enum (
  'fuel', 'rider_salary', 'vehicle_maintenance', 'packaging',
  'marketing', 'office', 'software', 'other'
);
create type dispatch_channel as enum ('whatsapp_link', 'whatsapp_api', 'manual', 'sms');
create type dispatch_state as enum ('queued', 'sent', 'accepted', 'rejected', 'expired', 'failed');

-- ---------- helper: updated_at ---------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- SETTINGS — one row per settings domain, validated by Zod client-side
-- =====================================================================
create table settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table settings is
  'Keys: brand, contact, social, theme, navigation, header, footer, seo, pwa, booking.';

-- =====================================================================
-- ADMINS
-- =====================================================================
create table admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null default 'admin',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- MEDIA
-- =====================================================================
create table media_assets (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null default 'media',
  path        text not null,
  public_url  text not null,
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint,
  kind        text not null default 'general',
  alt_text    text,
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);

-- =====================================================================
-- SERVICE AREAS + DISTANCE MATRIX
-- =====================================================================
create table service_areas (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  city               text,
  pin_code           text,
  radius_km          numeric(6,2),
  pickup_available   boolean not null default true,
  delivery_available boolean not null default true,
  display_order      int not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger t_service_areas_touch before update on service_areas
  for each row execute function touch_updated_at();

-- Admin-maintained distances. Stored once per unordered pair; the
-- distance service reads it symmetrically.
create table distance_matrix (
  id          uuid primary key default gen_random_uuid(),
  area_a_id   uuid not null references service_areas(id) on delete cascade,
  area_b_id   uuid not null references service_areas(id) on delete cascade,
  distance_km numeric(7,2) not null check (distance_km >= 0),
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  constraint distance_pair_ordered check (area_a_id <= area_b_id)
);
create unique index distance_matrix_pair_idx on distance_matrix (area_a_id, area_b_id);
create trigger t_distance_touch before update on distance_matrix
  for each row execute function touch_updated_at();

-- =====================================================================
-- PRICING
-- =====================================================================
create table pricing_rules (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  weight_from_kg           numeric(7,3) not null default 0,
  weight_to_kg             numeric(7,3) not null,
  distance_from_km         numeric(7,2) not null default 0,
  distance_to_km           numeric(7,2) not null,
  base_price               numeric(10,2) not null,
  per_km_price             numeric(10,2) not null default 0,
  additional_weight_charge numeric(10,2) not null default 0,
  additional_weight_step_kg numeric(7,3) not null default 1,
  max_charge               numeric(10,2),
  customer_type            customer_type not null default 'individual',
  priority                 int not null default 0,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint weight_range_valid check (weight_to_kg > weight_from_kg),
  constraint distance_range_valid check (distance_to_km >= distance_from_km)
);
create trigger t_pricing_touch before update on pricing_rules
  for each row execute function touch_updated_at();
create index pricing_rules_lookup_idx
  on pricing_rules (customer_type, is_active, priority desc);

-- =====================================================================
-- CATALOGUE / CMS
-- =====================================================================
create table services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  icon          text,
  image_url     text,
  display_order int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger t_services_touch before update on services
  for each row execute function touch_updated_at();

create table banners (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  subtitle       text,
  description    text,
  image_desktop  text,
  image_mobile   text,
  button_text    text,
  button_link    text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  auto_slide     boolean not null default true,
  display_order  int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger t_banners_touch before update on banners
  for each row execute function touch_updated_at();
create index banners_active_idx on banners (is_active, display_order);

create table content_sections (
  id            uuid primary key default gen_random_uuid(),
  page          text not null,
  section_key   text not null,
  title         text,
  subtitle      text,
  description   text,
  body          jsonb not null default '{}'::jsonb,
  image_url     text,
  cta_text      text,
  cta_link      text,
  display_order int not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (page, section_key)
);
create trigger t_content_touch before update on content_sections
  for each row execute function touch_updated_at();

create table faqs (
  id            uuid primary key default gen_random_uuid(),
  question      text not null,
  answer        text not null,
  category      text,
  display_order int not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

create table safety_rules (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  title         text not null,
  description   text,
  display_order int not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);
comment on column safety_rules.category is
  'e.g. prohibited_items, weight_limits, packaging, cancellation, returns, liability';

create table offers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  code            text unique,
  description     text,
  discount_type   discount_type not null,
  discount_value  numeric(10,2) not null check (discount_value >= 0),
  min_order_value numeric(10,2) not null default 0,
  max_discount    numeric(10,2),
  service_area_id uuid references service_areas(id) on delete set null,
  customer_type   customer_type,
  starts_at       timestamptz,
  ends_at         timestamptz,
  usage_limit     int,
  used_count      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger t_offers_touch before update on offers
  for each row execute function touch_updated_at();

-- =====================================================================
-- WORKING HOURS
-- =====================================================================
create table working_hours (
  day_of_week int primary key check (day_of_week between 0 and 6),
  is_open     boolean not null default true,
  opens_at    time,
  closes_at   time,
  updated_at  timestamptz not null default now()
);
comment on column working_hours.day_of_week is '0 = Sunday .. 6 = Saturday';

create table time_windows (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('pickup', 'delivery')),
  label         text not null,
  starts_at     time not null,
  ends_at       time not null,
  display_order int not null default 0,
  is_active     boolean not null default true
);

create table holidays (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  label      text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- PEOPLE
-- =====================================================================
create table customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,
  name       text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_customers_touch before update on customers
  for each row execute function touch_updated_at();

create table customer_addresses (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  label           text,
  address         text not null,
  landmark        text,
  service_area_id uuid references service_areas(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index customer_addresses_customer_idx on customer_addresses (customer_id);

create table business_customers (
  id              uuid primary key default gen_random_uuid(),
  business_name   text not null,
  contact_person  text,
  phone           text not null,
  email           text,
  address         text,
  service_area_id uuid references service_areas(id) on delete set null,
  special_pricing jsonb not null default '{}'::jsonb,
  monthly_billing boolean not null default false,
  credit_limit    numeric(12,2),
  credit_status   text not null default 'none',
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger t_biz_touch before update on business_customers
  for each row execute function touch_updated_at();

create table riders (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text not null,
  whatsapp        text,
  service_area_id uuid references service_areas(id) on delete set null,
  shift           text,
  availability    rider_availability not null default 'available',
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger t_riders_touch before update on riders
  for each row execute function touch_updated_at();
create index riders_dispatchable_idx on riders (is_active, availability);

-- =====================================================================
-- ORDERS
-- =====================================================================
create sequence order_code_seq;

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,

  -- customer
  customer_id         uuid references customers(id) on delete set null,
  customer_name       text not null,
  customer_phone      text not null,
  customer_type       customer_type not null default 'individual',
  business_customer_id uuid references business_customers(id) on delete set null,

  -- pickup
  pickup_area_id      uuid references service_areas(id) on delete set null,
  pickup_address      text not null,
  pickup_landmark     text,

  -- delivery
  delivery_area_id    uuid references service_areas(id) on delete set null,
  delivery_address    text not null,
  delivery_landmark   text,
  receiver_name       text not null,
  receiver_phone      text not null,

  -- parcel
  parcel_type         text not null,
  weight_kg           numeric(7,3) not null check (weight_kg > 0),
  parcel_description  text,
  is_fragile          boolean not null default false,

  -- schedule
  scheduled_date      date,
  pickup_window_id    uuid references time_windows(id) on delete set null,
  delivery_window_id  uuid references time_windows(id) on delete set null,

  -- pricing: frozen at creation, never recomputed
  distance_km         numeric(7,2),
  price_snapshot      jsonb not null,
  total_amount        numeric(10,2) not null,
  offer_id            uuid references offers(id) on delete set null,

  -- fulfilment
  status              order_status not null default 'order_placed',
  rider_id            uuid references riders(id) on delete set null,
  assigned_at         timestamptz,
  rider_token         text unique,
  delivery_otp        text,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  cancel_reason       text,

  -- payment
  payment_method      payment_method not null default 'upi',
  payment_status      payment_status not null default 'pending',

  internal_notes      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger t_orders_touch before update on orders
  for each row execute function touch_updated_at();

comment on column orders.price_snapshot is
  'Frozen price breakdown. Analytics and invoices read this, never pricing_rules.';
comment on column orders.rider_token is
  'Opaque single-order token for /r/<token>. Cleared on delivery or cancellation.';

create index orders_status_idx        on orders (status, created_at desc);
create index orders_created_idx       on orders (created_at desc);
create index orders_phone_idx         on orders (customer_phone);
create index orders_rider_idx         on orders (rider_id, status);
create index orders_payment_idx       on orders (payment_status, created_at desc);
create index orders_unassigned_idx    on orders (created_at) where rider_id is null;
create index orders_pickup_area_idx   on orders (pickup_area_id);
create index orders_delivery_area_idx on orders (delivery_area_id);

create table order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  status     order_status not null,
  note       text,
  actor_type text not null default 'system',
  actor_id   text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx
  on order_status_history (order_id, created_at);
comment on table order_status_history is 'Append-only. No update or delete policy exists.';

-- =====================================================================
-- PAYMENTS
-- =====================================================================
create table payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  method       payment_method not null,
  amount       numeric(10,2) not null,
  status       payment_status not null default 'pending',
  reference    text,
  paid_at      timestamptz,
  verified_by  uuid references admins(id) on delete set null,
  verified_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger t_payments_touch before update on payments
  for each row execute function touch_updated_at();
create index payments_order_idx  on payments (order_id);
create index payments_status_idx on payments (status, created_at desc);

-- =====================================================================
-- EXPENSES
-- =====================================================================
create table expenses (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       expense_category not null,
  amount         numeric(12,2) not null check (amount >= 0),
  spent_on       date not null,
  description    text,
  payment_method text,
  rider_id       uuid references riders(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger t_expenses_touch before update on expenses
  for each row execute function touch_updated_at();
create index expenses_date_idx     on expenses (spent_on desc);
create index expenses_category_idx on expenses (category, spent_on desc);

-- =====================================================================
-- DISPATCH — the outbox. V1 writes 'whatsapp_link' rows; a future
-- WhatsApp Cloud API worker writes 'whatsapp_api' rows against the
-- same table and the same claim function.
-- =====================================================================
create table dispatch_attempts (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  rider_id     uuid references riders(id) on delete set null,
  channel      dispatch_channel not null,
  state        dispatch_state not null default 'queued',
  payload      jsonb not null default '{}'::jsonb,
  provider_ref text,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger t_dispatch_touch before update on dispatch_attempts
  for each row execute function touch_updated_at();
create index dispatch_order_idx on dispatch_attempts (order_id, created_at desc);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  recipient  text,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'queued',
  error      text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index notifications_status_idx on notifications (status, created_at);
