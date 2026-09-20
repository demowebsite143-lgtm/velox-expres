import type {
  CustomerType,
  Offer,
  PriceSnapshot,
  PricingRule,
} from '@/types/database';

/**
 * The pricing engine.
 *
 * Deliberately a pure function with no database access: the Edge
 * Function that creates orders and the browser that previews prices run
 * the identical code, so the quote a customer sees and the amount that
 * is charged cannot drift apart.
 *
 * It invents nothing. If no rule covers the weight/distance combination
 * it returns `unavailable` and the UI says so.
 */

export const PRICING_ENGINE_VERSION = 1;

export interface PriceInput {
  weightKg: number;
  distanceKm: number | null;
  customerType: CustomerType;
  distanceSource?: string;
  /** Optional offer, already fetched. Validity is re-checked here. */
  offer?: Offer | null;
}

export type PriceResult =
  | { ok: true; snapshot: PriceSnapshot }
  | { ok: false; reason: PriceFailure; message: string };

export type PriceFailure =
  | 'no_rules_configured'
  | 'no_matching_rule'
  | 'distance_unknown'
  | 'invalid_weight';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Choose the rule that covers this order.
 *
 * Ties are broken by explicit priority first, then by the narrowest
 * weight band — a rule written specifically for 0–1 kg should beat a
 * catch-all 0–20 kg rule without the owner having to think about
 * priority numbers.
 */
export function selectRule(
  rules: PricingRule[],
  weightKg: number,
  distanceKm: number,
  customerType: CustomerType,
): PricingRule | null {
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
    const distA = Number(a.distance_to_km) - Number(a.distance_from_km);
    const distB = Number(b.distance_to_km) - Number(b.distance_from_km);
    return distA - distB;
  })[0];
}

/** Is this offer usable for this order right now? */
export function offerApplies(
  offer: Offer,
  subtotal: number,
  customerType: CustomerType,
  areaId: string | null,
  now = new Date(),
): boolean {
  if (!offer.is_active) return false;
  if (offer.starts_at && new Date(offer.starts_at) > now) return false;
  if (offer.ends_at && new Date(offer.ends_at) < now) return false;
  if (offer.usage_limit !== null && offer.used_count >= offer.usage_limit) return false;
  if (subtotal < Number(offer.min_order_value)) return false;
  if (offer.customer_type && offer.customer_type !== customerType) return false;
  if (offer.service_area_id && offer.service_area_id !== areaId) return false;
  return true;
}

export function discountFor(offer: Offer, subtotal: number): number {
  const raw =
    offer.discount_type === 'percentage'
      ? (subtotal * Number(offer.discount_value)) / 100
      : Number(offer.discount_value);
  const capped =
    offer.max_discount !== null ? Math.min(raw, Number(offer.max_discount)) : raw;
  return round2(Math.max(0, Math.min(capped, subtotal)));
}

export function calculatePrice(
  input: PriceInput,
  rules: PricingRule[],
  options: { areaId?: string | null; now?: Date } = {},
): PriceResult {
  const { weightKg, distanceKm, customerType } = input;

  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return {
      ok: false,
      reason: 'invalid_weight',
      message: 'Enter a parcel weight above zero.',
    };
  }

  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return {
      ok: false,
      reason: 'distance_unknown',
      message:
        'The distance between these two areas has not been set yet. Contact us and we will quote it.',
    };
  }

  if (rules.length === 0) {
    return {
      ok: false,
      reason: 'no_rules_configured',
      message: 'Pricing is currently unavailable.',
    };
  }

  const rule = selectRule(rules, weightKg, distanceKm, customerType);
  if (!rule) {
    return {
      ok: false,
      reason: 'no_matching_rule',
      message:
        'We do not have a rate for this weight and distance yet. Contact us for a quote.',
    };
  }

  const basePrice = Number(rule.base_price);
  const perKmCharge = round2(Number(rule.per_km_price) * distanceKm);

  // Extra weight is charged per step above the band's lower bound, so a
  // "1-5 kg, +20 per kg" rule behaves the way the owner expects.
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

  let discount = 0;
  let offerId: string | null = null;
  let offerName: string | null = null;

  if (input.offer) {
    const applies = offerApplies(
      input.offer,
      subtotal,
      customerType,
      options.areaId ?? null,
      options.now,
    );
    if (applies) {
      discount = discountFor(input.offer, subtotal);
      offerId = input.offer.id;
      offerName = input.offer.name;
    }
  }

  const finalAmount = round2(Math.max(0, subtotal - discount));

  return {
    ok: true,
    snapshot: {
      weightKg,
      distanceKm,
      basePrice: round2(basePrice),
      perKmCharge,
      additionalWeightCharge,
      subtotal,
      discount,
      offerId,
      offerName,
      cappedByMaxCharge,
      finalAmount,
      currency: 'INR',
      pricingRuleId: rule.id,
      pricingRuleName: rule.name,
      customerType,
      distanceSource: input.distanceSource ?? 'unknown',
      calculatedAt: new Date().toISOString(),
      engineVersion: PRICING_ENGINE_VERSION,
    },
  };
}

/** Line items for the price breakdown UI, built from a stored snapshot. */
export function breakdownLines(
  snapshot: PriceSnapshot,
): { label: string; amount: number; muted?: boolean }[] {
  const lines: { label: string; amount: number; muted?: boolean }[] = [
    { label: 'Base charge', amount: snapshot.basePrice },
  ];
  if (snapshot.perKmCharge > 0) {
    lines.push({
      label: `Distance (${snapshot.distanceKm ?? '—'} km)`,
      amount: snapshot.perKmCharge,
    });
  }
  if (snapshot.additionalWeightCharge > 0) {
    lines.push({ label: 'Extra weight', amount: snapshot.additionalWeightCharge });
  }
  if (snapshot.cappedByMaxCharge) {
    lines.push({ label: 'Capped at maximum charge', amount: 0, muted: true });
  }
  if (snapshot.discount > 0) {
    lines.push({
      label: snapshot.offerName ? `Offer — ${snapshot.offerName}` : 'Discount',
      amount: -snapshot.discount,
    });
  }
  return lines;
}
