# Velox Express

Courier and parcel delivery platform. Public booking site, customer tracking,
rider job sheets and an admin control panel, on React + Vite + TypeScript +
Tailwind with Supabase (Postgres, Auth, Storage, Edge Functions) behind it.

## Running it

```bash
npm install
cp .env.example .env.local     # fill in your Supabase URL and anon key
npm run dev
```

The app runs without credentials. Every screen renders; anything data-backed
shows a "database not connected" state rather than sample rows.

## Supabase setup

```bash
supabase link --project-ref <your-ref>
supabase db push                       # runs the four migrations in order
supabase functions deploy create-order
supabase functions deploy rider-portal
```

Then create your admin user:

1. Supabase dashboard → Authentication → add a user with email and password.
2. SQL editor:
   ```sql
   insert into admins (id, name, email)
   values ('<that-user-uuid>', 'Your name', 'you@example.com');
   ```

Being in `auth.users` is not enough — the `admins` row is what `is_admin()`
checks, and it gates both the UI and every row-level policy.

## How it is put together

**Settings spine.** One `settings` table, one row per domain (brand, contact,
social, theme, navigation, header, footer, seo, pwa, booking, payments), each
validated by a Zod schema shared between the admin form and the runtime
reader. `SettingsProvider` loads it once and every component reads from there.
No component contains a phone number, brand name, colour or address.

Brand colours are written to CSS custom properties as RGB channel triplets, so
Tailwind opacity utilities (`bg-primary/10`) keep working and a colour change
takes effect with no rebuild.

**Price snapshots.** The pricing engine (`src/services/pricingEngine.ts`) is a
pure function with no I/O, so the browser preview and the `create-order` Edge
Function run identical arithmetic. The full breakdown is frozen into
`orders.price_snapshot` at creation and never recalculated. Editing the rate
chart tomorrow does not touch yesterday's orders, and revenue analytics read
the snapshot rather than current rules.

Orders are created through the Edge Function rather than a client insert,
because the price has to be decided server-side. The client's quote is a
preview.

**Distance without Google.** Distances come from an admin-maintained matrix of
area pairs, behind a `DistanceProvider` interface. A Google provider can be
registered later without booking, pricing or any component changing.

**Dispatch.** Two operations: `dispatchOrder(order)` picks candidate riders,
`claimOrder(orderId, riderId)` binds one atomically. The whole concurrency
mechanism is a single conditional `UPDATE ... WHERE rider_id IS NULL`, so the
same code survives a future WhatsApp broadcast where several riders race to
accept. It also stops two admin browser tabs double-assigning.

**WhatsApp is not automated.** V1 opens a `wa.me` link with the message
prefilled; a person presses send. The transport interface is in place so a
Cloud API implementation can replace it, and the unwired one throws rather
than silently dropping messages.

**Security.** There is no public SELECT policy on orders, customers, riders,
payments or expenses, and deliberately no "customers read their own orders"
policy — anonymous booking means there is no session to scope it to. Tracking
goes through `track_order(code, phone)`, a security-definer function returning
a narrowed projection with no internal notes, rider phone or cost data. Rider
tokens never grant table access; they are checked only inside an Edge Function
running with the service role, and the token is cleared on delivery.

## What is deliberately not in here

No sample orders, riders, customers, prices, revenue, expenses, reviews,
ratings, delivery counts, UPI IDs or QR codes. The seed migration contains
only the business facts from the brief plus neutral UI copy. Everything else
stays empty until the owner enters it, and screens show an honest empty state
instead of a number that looks like a measurement.

Two things the UI never claims: automatic WhatsApp sending, and live GPS
tracking. Neither exists, so neither is implied.

## Project layout

```
src/
  schemas/settings.ts     Zod schemas — the contract for all configuration
  services/               pricing, distance, dispatch, orders, analytics, media
  providers/              settings, auth, toast
  components/ui/          buttons, fields, overlays, loading/empty/error states
  pages/public/           booking site, calculator, tracking
  pages/rider/            token-only job sheet
  pages/admin/            control panel
supabase/
  migrations/             schema, functions, RLS, settings bootstrap
  functions/              create-order, rider-portal
```

## Build status

Implemented end to end: foundation, design system, settings architecture,
database schema with RLS, pricing engine, distance matrix, public website,
booking flow, customer tracking, rider job sheet, admin authentication,
Edge Functions, PWA manifest, and the full admin panel — dashboard, orders
with dispatch, riders, pricing & distance matrix, website content (CMS,
banners, services, offers, FAQ, safety rules, hours), business accounts,
payment verification, expenses, media library, reports with charts, CSV
and PDF export, and settings for all 11 configuration domains.

Nothing is left as a placeholder screen. What remains is what only a real
environment can do: `npm install` against the live npm registry, a real
`tsc`/`vite build`, and testing against an actual Supabase project.
