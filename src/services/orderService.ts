import { requireClient, callFunction } from '@/lib/supabase';
import type {
  Order,
  OrderStatus,
  OrderStatusHistoryRow,
  PaymentStatus,
  TrackingResult,
} from '@/types/database';

export interface OrderFilters {
  status?: OrderStatus | 'all';
  paymentStatus?: PaymentStatus | 'all';
  riderId?: string | 'all' | 'unassigned';
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface OrderWithRelations extends Order {
  rider?: { id: string; name: string; phone: string } | null;
  pickup_area?: { name: string } | null;
  delivery_area?: { name: string } | null;
}

const RELATIONS =
  '*, rider:riders(id, name, phone), pickup_area:service_areas!orders_pickup_area_id_fkey(name), delivery_area:service_areas!orders_delivery_area_id_fkey(name)';

export async function listOrders(filters: OrderFilters = {}): Promise<OrderWithRelations[]> {
  const client = requireClient();
  let query = client.from('orders').select(RELATIONS).order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    query = query.eq('payment_status', filters.paymentStatus);
  }
  if (filters.riderId === 'unassigned') query = query.is('rider_id', null);
  else if (filters.riderId && filters.riderId !== 'all') query = query.eq('rider_id', filters.riderId);

  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59`);

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,receiver_name.ilike.%${term}%`,
    );
  }

  query = query.limit(filters.limit ?? 200);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderWithRelations[];
}

export async function getOrder(id: string): Promise<OrderWithRelations | null> {
  const client = requireClient();
  const { data, error } = await client.from('orders').select(RELATIONS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as OrderWithRelations) ?? null;
}

export async function getStatusHistory(orderId: string): Promise<OrderStatusHistoryRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrderStatusHistoryRow[];
}

/**
 * Which statuses can follow the current one. Encoded once here so the
 * admin UI and the rider portal cannot disagree about the lifecycle.
 */
export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  order_placed: ['confirmed', 'finding_rider', 'cancelled'],
  confirmed: ['finding_rider', 'cancelled'],
  finding_rider: ['rider_assigned', 'cancelled'],
  rider_assigned: ['picked_up', 'finding_rider', 'cancelled'],
  picked_up: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  order_placed: 'Order placed',
  confirmed: 'Confirmed',
  finding_rider: 'Finding rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'Picked up',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** The customer-facing timeline. Cancelled is handled separately. */
export const CUSTOMER_TIMELINE: OrderStatus[] = [
  'order_placed',
  'finding_rider',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
];

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<Order> {
  const client = requireClient();

  const patch: Record<string, unknown> = { status };
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();
  if (status === 'picked_up') patch.picked_up_at = new Date().toISOString();
  if (status === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
    if (note) patch.cancel_reason = note;
    patch.rider_token = null;
  }

  const { data, error } = await client
    .from('orders')
    .update(patch)
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;

  // Free the rider when the job ends either way.
  const order = data as Order;
  if ((status === 'delivered' || status === 'cancelled') && order.rider_id) {
    await client.from('riders').update({ availability: 'available' }).eq('id', order.rider_id);
  }

  return order;
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('orders')
    .update({ payment_status: paymentStatus })
    .eq('id', orderId);
  if (error) throw error;
}

export async function setInternalNotes(orderId: string, notes: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('orders').update({ internal_notes: notes }).eq('id', orderId);
  if (error) throw error;
}

/**
 * Customer tracking. Goes through the security-definer function, which
 * returns a narrowed projection — no internal notes, no rider phone,
 * no cost data. There is no RLS policy that would let this be a plain
 * table read, by design.
 */
export async function trackOrder(code: string, phone: string): Promise<TrackingResult | null> {
  const client = requireClient();
  const { data, error } = await client.rpc('track_order', {
    p_code: code.trim(),
    p_phone: phone.trim(),
  });
  if (error) throw error;
  return (data as TrackingResult) ?? null;
}

export interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  customerType: 'individual' | 'business';
  pickupAreaId: string;
  pickupAddress: string;
  pickupLandmark?: string;
  deliveryAreaId: string;
  deliveryAddress: string;
  deliveryLandmark?: string;
  receiverName: string;
  receiverPhone: string;
  parcelType: string;
  weightKg: number;
  parcelDescription?: string;
  isFragile: boolean;
  scheduledDate?: string | null;
  pickupWindowId?: string | null;
  deliveryWindowId?: string | null;
  paymentMethod: 'upi' | 'cash' | 'pay_later';
  offerCode?: string | null;
}

export interface CreateOrderResult {
  code: string;
  totalAmount: number;
  deliveryOtp: string;
  paymentMethod: string;
}

/**
 * Order creation goes through an Edge Function, never a direct insert.
 * The server recalculates the price with the same engine, so a modified
 * client cannot choose its own total.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  return callFunction<CreateOrderResult>('create-order', payload);
}
