-- =====================================================================
-- VELOX EXPRESS — Row Level Security
--
-- Model:
--   * RLS is on for every table. Default is deny.
--   * anon/authenticated get SELECT on published website content only.
--   * Orders, customers, riders, payments, expenses, business data and
--     media have NO public policy at all. There is deliberately no
--     "customers can read their own orders" policy — anonymous booking
--     means there is no session to scope it to. Tracking goes through
--     the track_order() security-definer function instead.
--   * Admin access is granted by is_admin(), which checks the admins
--     table, not a JWT claim a client could influence.
-- =====================================================================

alter table settings            enable row level security;
alter table admins              enable row level security;
alter table media_assets        enable row level security;
alter table service_areas       enable row level security;
alter table distance_matrix     enable row level security;
alter table pricing_rules       enable row level security;
alter table services            enable row level security;
alter table banners             enable row level security;
alter table content_sections    enable row level security;
alter table faqs                enable row level security;
alter table safety_rules        enable row level security;
alter table offers              enable row level security;
alter table working_hours       enable row level security;
alter table time_windows        enable row level security;
alter table holidays            enable row level security;
alter table customers           enable row level security;
alter table customer_addresses  enable row level security;
alter table business_customers  enable row level security;
alter table riders              enable row level security;
alter table orders              enable row level security;
alter table order_status_history enable row level security;
alter table payments            enable row level security;
alter table expenses            enable row level security;
alter table dispatch_attempts   enable row level security;
alter table notifications       enable row level security;

-- ---------------------------------------------------------------------
-- PUBLIC READ — website content the site cannot render without.
-- Nothing here is confidential. Do not put API keys or secrets in the
-- settings table; secrets belong in Edge Function environment vars.
-- ---------------------------------------------------------------------
create policy "public reads settings" on settings
  for select using (true);

create policy "public reads active services" on services
  for select using (is_active);

create policy "public reads live banners" on banners
  for select using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

create policy "public reads active content" on content_sections
  for select using (is_active);

create policy "public reads active faqs" on faqs
  for select using (is_active);

create policy "public reads active safety rules" on safety_rules
  for select using (is_active);

create policy "public reads live offers" on offers
  for select using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

create policy "public reads active areas" on service_areas
  for select using (is_active);

create policy "public reads active distances" on distance_matrix
  for select using (is_active);

-- The rate chart is published information — the calculator is a public
-- page. Order totals are still recomputed server-side at booking so a
-- tampered client cannot set its own price.
create policy "public reads active pricing" on pricing_rules
  for select using (is_active);

create policy "public reads working hours" on working_hours
  for select using (true);

create policy "public reads active windows" on time_windows
  for select using (is_active);

create policy "public reads holidays" on holidays
  for select using (true);

-- ---------------------------------------------------------------------
-- ADMIN — full access on everything.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'settings','media_assets','service_areas','distance_matrix','pricing_rules',
    'services','banners','content_sections','faqs','safety_rules','offers',
    'working_hours','time_windows','holidays','customers','customer_addresses',
    'business_customers','riders','orders','payments','expenses',
    'dispatch_attempts','notifications'
  ] loop
    execute format(
      'create policy "admin full access" on %I for all to authenticated
         using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Status history is append-only even for admins: read and insert, never
-- update or delete. The audit trail is worth more than tidiness.
create policy "admin reads status history" on order_status_history
  for select to authenticated using (is_admin());
create policy "admin appends status history" on order_status_history
  for insert to authenticated with check (is_admin());

-- Admins may read their own row (needed for the session bootstrap).
create policy "admin reads own record" on admins
  for select to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------
-- EXPLICIT NON-POLICIES — documented so nobody "fixes" the gap later.
--
-- orders           : no anon SELECT. Tracking = track_order() only.
-- customers        : no anon anything. Phone numbers are not public.
-- riders           : no anon anything. Rider names reach the customer
--                    only through the narrowed track_order() payload.
-- payments         : admin only.
-- expenses         : admin only. This is the business's cost base.
-- business_customers: admin only, includes credit terms.
-- media_assets     : admin only for the row; files are public in storage.
-- ---------------------------------------------------------------------

-- =====================================================================
-- STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public reads media files" on storage.objects
  for select using (bucket_id = 'media');

create policy "admin uploads media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and is_admin());

create policy "admin updates media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and is_admin());

create policy "admin deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and is_admin());

-- =====================================================================
-- FUNCTION GRANTS
-- Only the two customer-safe functions are exposed to anon. claim_order,
-- release_order and the rider functions are service-role only and are
-- reached through Edge Functions.
-- =====================================================================
revoke execute on function claim_order(uuid, uuid)        from anon, authenticated;
revoke execute on function release_order(uuid)            from anon;
revoke execute on function rider_order_by_token(text)     from anon, authenticated;
revoke execute on function rider_advance_status(text, order_status, text) from anon, authenticated;
revoke execute on function analytics_summary(date, date)  from anon;
revoke execute on function analytics_daily(date, date)    from anon;

grant execute on function track_order(text, text) to anon, authenticated;
grant execute on function claim_order(uuid, uuid)          to authenticated;
grant execute on function release_order(uuid)              to authenticated;
grant execute on function analytics_summary(date, date)    to authenticated;
grant execute on function analytics_daily(date, date)      to authenticated;
