// @ts-nocheck — Deno runtime. Types resolve in the Supabase Edge environment.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, fail, json } from '../_shared/cors.ts';

/**
 * Order creation.
 *
 * Why this is a function and not a direct insert: the price must be
 * calculated server-side. If the browser could insert an order it could
 * also choose its own total. The client's quote is a preview; this is
 * the authority.
 *
 * It also writes the snapshot that every later revenue figure reads, so
 * this is the one place where money enters the system.
 */

const PRICING_ENGINE_VERSION = 1;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function selectRule(rules, weightKg, distanceKm, customerType) {
  const candidates = rules.filter(
    (r) =>
      r.is_active &&
      r.customer_type === customerType &&
      weightKg > Number(r.weight_from_kg) - 1e-9 &&
      weightKg <= Number(r.weight_to_kg) + 1e-9 &&
      distanceKm >= Number(r.distance_from_km) - 1e-9 &&
      distanceKm <= Number(r.distance_to_km) + 1e-9,
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const spanA = Number(a.weight_to_kg) - Number(a.weight_from_kg);
    const spanB = Number(b.weight_to_kg) - Number(b.weight_from_kg);
    if (spanA !== spanB) return spanA - spanB;
    return (
      Number(a.distance_to_km) - Number(a.distance_from_km) -
      (Number(b.distance_to_km) - Number(b.distance_from_km))
    );
  })[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Use POST', 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  let body;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid request body');
  }

  const required = [
    'customerName', 'customerPhone', 'pickupAreaId', 'pickupAddress',
    'deliveryAreaId', 'deliveryAddress', 'receiverName', 'parcelType', 'weightKg',
  ];
  for (const field of required) {
    if (!body[field]) return fail(`Missing ${field}`);
  }

  const weightKg = Number(body.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) return fail('Invalid weight');

  const customerType = body.customerType === 'business' ? 'business' : 'individual';

  // ---- distance, from the admin matrix (symmetric lookup) -----------
  const [a, b] =
    body.pickupAreaId <= body.deliveryAreaId
      ? [body.pickupAreaId, body.deliveryAreaId]
      : [body.deliveryAreaId, body.pickupAreaId];

  const { data: distanceRow } = await admin
    .from('distance_matrix')
    .select('distance_km')
    .eq('area_a_id', a)
    .eq('area_b_id', b)
    .eq('is_active', true)
    .maybeSingle();

  if (!distanceRow) {
    return fail('The distance between these areas has not been configured yet.', 422);
  }
  const distanceKm = Number(distanceRow.distance_km);

  // ---- price, recalculated here, never trusted from the client ------
  const { data: rules } = await admin.from('pricing_rules').select('*').eq('is_active', true);
  if (!rules || rules.length === 0) {
    return fail('Pricing is currently unavailable.', 422);
  }

  const rule = selectRule(rules, weightKg, distanceKm, customerType);
  if (!rule) return fail('No rate matches this weight and distance.', 422);

  const basePrice = Number(rule.base_price);
  const perKmCharge = round2(Number(rule.per_km_price) * distanceKm);
  const step = Number(rule.additional_weight_step_kg) || 1;
  const overWeight = Math.max(0, weightKg - Number(rule.weight_from_kg));
  const steps = Math.max(0, Math.ceil(overWeight / step) - 1);
  const additionalWeightCharge = round2(steps * Number(rule.additional_weight_charge));

  let subtotal = round2(basePrice + perKmCharge + additionalWeightCharge);
  let cappedByMaxCharge = false;
  if (rule.max_charge !== null && subtotal > Number(rule.max_charge)) {
    subtotal = round2(Number(rule.max_charge));
    cappedByMaxCharge = true;
  }

  // ---- offer, re-validated server side ------------------------------
  let discount = 0;
  let offer = null;
  if (body.offerCode) {
    const { data: found } = await admin
      .from('offers')
      .select('*')
      .eq('code', body.offerCode)
      .eq('is_active', true)
      .maybeSingle();

    if (found) {
      const now = Date.now();
      const live =
        (!found.starts_at || new Date(found.starts_at).getTime() <= now) &&
        (!found.ends_at || new Date(found.ends_at).getTime() >= now) &&
        (found.usage_limit === null || found.used_count < found.usage_limit) &&
        subtotal >= Number(found.min_order_value) &&
        (!found.customer_type || found.customer_type === customerType);

      if (live) {
        const raw =
          found.discount_type === 'percentage'
            ? (subtotal * Number(found.discount_value)) / 100
            : Number(found.discount_value);
        discount = round2(
          Math.max(0, Math.min(found.max_discount !== null
            ? Math.min(raw, Number(found.max_discount)) : raw, subtotal)),
        );
        offer = found;
      }
    }
  }

  const finalAmount = round2(Math.max(0, subtotal - discount));

  const priceSnapshot = {
    weightKg, distanceKm,
    basePrice: round2(basePrice),
    perKmCharge, additionalWeightCharge, subtotal, discount,
    offerId: offer?.id ?? null,
    offerName: offer?.name ?? null,
    cappedByMaxCharge, finalAmount,
    currency: 'INR',
    pricingRuleId: rule.id,
    pricingRuleName: rule.name,
    customerType,
    distanceSource: 'admin_matrix',
    calculatedAt: new Date().toISOString(),
    engineVersion: PRICING_ENGINE_VERSION,
  };

  // ---- customer record, keyed by phone ------------------------------
  const phone = String(body.customerPhone).replace(/\D/g, '');
  const { data: customer } = await admin
    .from('customers')
    .upsert({ phone, name: body.customerName }, { onConflict: 'phone' })
    .select()
    .single();

  // ---- order --------------------------------------------------------
  const { data: codeResult } = await admin.rpc('next_order_code');
  const { data: otpResult } = await admin.rpc('generate_delivery_otp');

  const { data: order, error } = await admin
    .from('orders')
    .insert({
      code: codeResult,
      customer_id: customer?.id ?? null,
      customer_name: body.customerName,
      customer_phone: phone,
      customer_type: customerType,
      pickup_area_id: body.pickupAreaId,
      pickup_address: body.pickupAddress,
      pickup_landmark: body.pickupLandmark ?? null,
      delivery_area_id: body.deliveryAreaId,
      delivery_address: body.deliveryAddress,
      delivery_landmark: body.deliveryLandmark ?? null,
      receiver_name: body.receiverName,
      receiver_phone: String(body.receiverPhone ?? '').replace(/\D/g, ''),
      parcel_type: body.parcelType,
      weight_kg: weightKg,
      parcel_description: body.parcelDescription ?? null,
      is_fragile: Boolean(body.isFragile),
      scheduled_date: body.scheduledDate || null,
      pickup_window_id: body.pickupWindowId || null,
      delivery_window_id: body.deliveryWindowId || null,
      distance_km: distanceKm,
      price_snapshot: priceSnapshot,
      total_amount: finalAmount,
      offer_id: offer?.id ?? null,
      payment_method: body.paymentMethod ?? 'cash',
      payment_status: 'pending',
      status: 'order_placed',
      delivery_otp: otpResult,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);

  await admin.from('payments').insert({
    order_id: order.id,
    method: order.payment_method,
    amount: finalAmount,
    status: 'pending',
  });

  if (offer) {
    await admin.from('offers').update({ used_count: offer.used_count + 1 }).eq('id', offer.id);
  }

  return json({
    code: order.code,
    totalAmount: Number(order.total_amount),
    deliveryOtp: order.delivery_otp,
    paymentMethod: order.payment_method,
  });
});
