import { requireClient } from '@/lib/supabase';
import type { Order, Rider } from '@/types/database';
import * as whatsapp from './whatsappService';

/**
 * Dispatch has exactly two operations. V1 implements them with admin
 * selection; a future WhatsApp broadcast implements the same two.
 *
 *   dispatchOrder(order)            -> decide who should be offered it
 *   claimOrder(orderId, riderId)    -> atomically bind rider to order
 *
 * claimOrder is byte-identical across both versions because the whole
 * concurrency mechanism lives in one SQL statement (see claim_order in
 * 0002_functions.sql). It guards the admin path too, so two open
 * browser tabs cannot double-assign the same order.
 */

export interface ClaimResult {
  claimed: boolean;
  orderId: string;
  orderCode: string | null;
  riderId: string | null;
  riderToken: string | null;
  /** Populated when claimed is false, for a precise message. */
  reason?: 'already_assigned' | 'not_claimable';
}

export interface DispatchCandidates {
  riders: Rider[];
  /** Riders in the order's pickup area, listed first. */
  preferredAreaId: string | null;
  note: string | null;
}

/**
 * Who can take this order? V1 returns the list for a human to choose
 * from. The API version will send to exactly this same set.
 */
export async function dispatchOrder(order: Order): Promise<DispatchCandidates> {
  const client = requireClient();

  const { data, error } = await client
    .from('riders')
    .select('*')
    .eq('is_active', true)
    .neq('availability', 'off_duty')
    .order('availability', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  const riders = (data as Rider[]) ?? [];
  const preferredAreaId = order.pickup_area_id;

  const ranked = [...riders].sort((a, b) => {
    const aMatch = a.service_area_id === preferredAreaId ? 0 : 1;
    const bMatch = b.service_area_id === preferredAreaId ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    if (a.availability !== b.availability) {
      return a.availability === 'available' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    riders: ranked,
    preferredAreaId,
    note:
      ranked.length === 0
        ? 'No active riders are available. Add a rider or set one back on duty.'
        : null,
  };
}

/**
 * Atomic bind. Returns claimed:false when someone got there first —
 * that is a normal outcome, not an error.
 */
export async function claimOrder(
  orderId: string,
  riderId: string,
): Promise<ClaimResult> {
  const client = requireClient();

  const { data, error } = await client.rpc('claim_order', {
    p_order_id: orderId,
    p_rider_id: riderId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.claimed) {
    return {
      claimed: false,
      orderId,
      orderCode: null,
      riderId: null,
      riderToken: null,
      reason: 'already_assigned',
    };
  }

  // Mark the rider busy. Separate from the claim on purpose: a failure
  // here must not undo an assignment that already succeeded.
  await client.from('riders').update({ availability: 'busy' }).eq('id', riderId);

  await client.from('dispatch_attempts').insert({
    order_id: orderId,
    rider_id: riderId,
    channel: 'manual',
    state: 'accepted',
    payload: { assigned_by: 'admin' },
  });

  return {
    claimed: true,
    orderId: row.order_id,
    orderCode: row.order_code,
    riderId: row.rider_id,
    riderToken: row.rider_token,
  };
}

export async function releaseOrder(orderId: string): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client.rpc('release_order', { p_order_id: orderId });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Hand the assignment to the rider over WhatsApp. In V1 this returns a
 * wa.me URL for the admin to open — it does not send anything.
 */
export async function notifyRider(
  order: Order,
  rider: Rider,
  ctx: whatsapp.OrderMessageContext,
  countryCode: string,
): Promise<whatsapp.MessageResult> {
  const client = requireClient();
  const result = await whatsapp.sendOrderToRider(order, rider, ctx, countryCode);

  await client.from('dispatch_attempts').insert({
    order_id: order.id,
    rider_id: rider.id,
    channel: result.mode === 'link' ? 'whatsapp_link' : 'whatsapp_api',
    state: result.delivered ? 'sent' : 'queued',
    payload: { note: result.note },
  });

  return result;
}

export function riderPortalUrl(token: string): string {
  return `${window.location.origin}/r/${token}`;
}

export function trackingUrl(code: string): string {
  return `${window.location.origin}/track?order=${encodeURIComponent(code)}`;
}
