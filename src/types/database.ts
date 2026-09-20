/**
 * Row types mirroring supabase/migrations/0001_schema.sql.
 *
 * Regenerate with `supabase gen types typescript --linked` once your
 * project is linked; until then these are maintained by hand and are the
 * single source of truth for the service layer.
 */

export type OrderStatus =
  | 'order_placed'
  | 'confirmed'
  | 'finding_rider'
  | 'rider_assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'submitted'
  | 'verified'
  | 'failed'
  | 'refunded';

export type PaymentMethod = 'upi' | 'cash' | 'pay_later' | 'gateway';
export type CustomerType = 'individual' | 'business';
export type DiscountType = 'percentage' | 'flat';
export type RiderAvailability = 'available' | 'busy' | 'off_duty';

export type ExpenseCategory =
  | 'fuel'
  | 'rider_salary'
  | 'vehicle_maintenance'
  | 'packaging'
  | 'marketing'
  | 'office'
  | 'software'
  | 'other';

export type DispatchChannel = 'whatsapp_link' | 'whatsapp_api' | 'manual' | 'sms';
export type DispatchState =
  | 'queued'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'failed';

export interface ServiceArea {
  id: string;
  name: string;
  city: string | null;
  pin_code: string | null;
  radius_km: number | null;
  pickup_available: boolean;
  delivery_available: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DistanceMatrixRow {
  id: string;
  area_a_id: string;
  area_b_id: string;
  distance_km: number;
  is_active: boolean;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  name: string;
  weight_from_kg: number;
  weight_to_kg: number;
  distance_from_km: number;
  distance_to_km: number;
  base_price: number;
  per_km_price: number;
  additional_weight_charge: number;
  additional_weight_step_kg: number;
  max_charge: number | null;
  customer_type: CustomerType;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_desktop: string | null;
  image_mobile: string | null;
  button_text: string | null;
  button_link: string | null;
  starts_at: string | null;
  ends_at: string | null;
  auto_slide: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentSection {
  id: string;
  page: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  body: Record<string, unknown>;
  image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface SafetyRule {
  id: string;
  category: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface Offer {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  service_area_id: string | null;
  customer_type: CustomerType | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkingHour {
  day_of_week: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  updated_at: string;
}

export interface TimeWindow {
  id: string;
  kind: 'pickup' | 'delivery';
  label: string;
  starts_at: string;
  ends_at: string;
  display_order: number;
  is_active: boolean;
}

export interface Holiday {
  id: string;
  date: string;
  label: string;
  created_at: string;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  service_area_id: string | null;
  shift: string | null;
  availability: RiderAvailability;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessCustomer {
  id: string;
  business_name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  service_area_id: string | null;
  special_pricing: Record<string, unknown>;
  monthly_billing: boolean;
  credit_limit: number | null;
  credit_status: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * The frozen price breakdown stored on every order.
 *
 * Once written this is never recomputed. If the owner edits the rate
 * chart tomorrow, yesterday's orders keep yesterday's numbers, and
 * revenue analytics read this object rather than pricing_rules.
 */
export interface PriceSnapshot {
  weightKg: number;
  distanceKm: number | null;
  basePrice: number;
  perKmCharge: number;
  additionalWeightCharge: number;
  subtotal: number;
  discount: number;
  offerId: string | null;
  offerName: string | null;
  cappedByMaxCharge: boolean;
  finalAmount: number;
  currency: 'INR';
  pricingRuleId: string;
  pricingRuleName: string;
  customerType: CustomerType;
  distanceSource: string;
  calculatedAt: string;
  engineVersion: number;
}

export interface Order {
  id: string;
  code: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_type: CustomerType;
  business_customer_id: string | null;
  pickup_area_id: string | null;
  pickup_address: string;
  pickup_landmark: string | null;
  delivery_area_id: string | null;
  delivery_address: string;
  delivery_landmark: string | null;
  receiver_name: string;
  receiver_phone: string;
  parcel_type: string;
  weight_kg: number;
  parcel_description: string | null;
  is_fragile: boolean;
  scheduled_date: string | null;
  pickup_window_id: string | null;
  delivery_window_id: string | null;
  distance_km: number | null;
  price_snapshot: PriceSnapshot;
  total_amount: number;
  offer_id: string | null;
  status: OrderStatus;
  rider_id: string | null;
  assigned_at: string | null;
  rider_token: string | null;
  delivery_otp: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  reference: string | null;
  paid_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  spent_on: string;
  description: string | null;
  payment_method: string | null;
  rider_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  bucket: string;
  path: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  alt_text: string | null;
  created_at: string;
}

export interface DispatchAttempt {
  id: string;
  order_id: string;
  rider_id: string | null;
  channel: DispatchChannel;
  state: DispatchState;
  payload: Record<string, unknown>;
  provider_ref: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

/** Narrowed payload returned by the track_order() function. */
export interface TrackingResult {
  code: string;
  status: OrderStatus;
  created_at: string;
  scheduled_date: string | null;
  pickup_area: string | null;
  delivery_area: string | null;
  receiver_name: string;
  parcel_type: string;
  weight_kg: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  delivery_otp: string | null;
  rider_name: string | null;
  history: { status: OrderStatus; at: string }[];
}

/** Narrowed payload returned by rider_order_by_token(). */
export interface RiderOrderView {
  code: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_landmark: string | null;
  pickup_area: string | null;
  receiver_name: string;
  receiver_phone: string;
  delivery_address: string;
  delivery_landmark: string | null;
  delivery_area: string | null;
  parcel_type: string;
  weight_kg: number;
  is_fragile: boolean;
  parcel_description: string | null;
  distance_km: number | null;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  scheduled_date: string | null;
  rider_name: string | null;
}

export interface AnalyticsSummary {
  revenue: number;
  expenses: number;
  net_profit: number;
  revenue_order_count: number;
  avg_order_value: number;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  in_progress_orders: number;
  pending_payment_amount: number;
  active_riders: number;
  customers: number;
  from: string;
  to: string;
}

export interface AnalyticsDailyRow {
  day: string;
  revenue: number;
  expenses: number;
  orders: number;
}
