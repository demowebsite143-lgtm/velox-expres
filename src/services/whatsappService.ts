import type { Order, Rider } from '@/types/database';
import { whatsappLink } from '@/lib/utils';
import { money, weight } from '@/lib/format';

/**
 * WhatsApp messaging behind one interface.
 *
 * IMPORTANT, AND STATED PLAINLY IN THE UI TOO: this is not automated
 * WhatsApp. The link transport opens a prefilled chat that a human
 * sends. Nothing is delivered without somebody pressing send.
 *
 * A `CloudApiTransport` can be added later that implements the same
 * three methods against Meta's Cloud API. Callers do not change.
 */

export type TransportMode = 'link' | 'api';

export interface MessageResult {
  mode: TransportMode;
  /** Present for link mode — the caller opens it. */
  url?: string;
  delivered: boolean;
  note: string;
}

export interface WhatsappTransport {
  readonly mode: TransportMode;
  readonly automated: boolean;
  send(to: string, body: string, countryCode: string): Promise<MessageResult>;
}

/** Ships in V1. Opens wa.me; a person presses send. */
export class LinkTransport implements WhatsappTransport {
  readonly mode = 'link' as const;
  readonly automated = false;

  async send(to: string, body: string, countryCode: string): Promise<MessageResult> {
    return {
      mode: 'link',
      url: whatsappLink(to, countryCode, body),
      delivered: false,
      note: 'Opens WhatsApp with the message prefilled. You still press send.',
    };
  }
}

/**
 * Not wired up. Present so the shape of the eventual integration is
 * fixed now. It refuses rather than silently doing nothing, which
 * would look like a working feature that drops messages.
 */
export class CloudApiTransport implements WhatsappTransport {
  readonly mode = 'api' as const;
  readonly automated = true;

  async send(): Promise<MessageResult> {
    throw new Error(
      'WhatsApp Business API is not connected. Configure the credentials in the Edge Function environment and enable it in Settings.',
    );
  }
}

let transport: WhatsappTransport = new LinkTransport();

export function getTransport(): WhatsappTransport {
  return transport;
}
export function setTransport(next: WhatsappTransport) {
  transport = next;
}

// ---------------------------------------------------------------------
// Message bodies. English only, kept short enough to read on a phone
// without expanding the message.
// ---------------------------------------------------------------------

export interface OrderMessageContext {
  brandName: string;
  /** Only the name is ever used in a message body — no need for the full row. */
  pickupArea?: { name: string } | null;
  deliveryArea?: { name: string } | null;
  trackingUrl?: string;
  riderUrl?: string;
}

export function riderAssignmentMessage(
  order: Order,
  ctx: OrderMessageContext,
): string {
  const lines = [
    `NEW ${ctx.brandName.toUpperCase()} DELIVERY`,
    '',
    `Order: ${order.code}`,
    `Pickup: ${order.pickup_address}${ctx.pickupArea ? `, ${ctx.pickupArea.name}` : ''}`,
    order.pickup_landmark ? `Landmark: ${order.pickup_landmark}` : null,
    `Deliver to: ${order.delivery_address}${ctx.deliveryArea ? `, ${ctx.deliveryArea.name}` : ''}`,
    order.delivery_landmark ? `Landmark: ${order.delivery_landmark}` : null,
    `Receiver: ${order.receiver_name} (${order.receiver_phone})`,
    `Parcel: ${order.parcel_type}, ${weight(order.weight_kg)}${order.is_fragile ? ' — FRAGILE' : ''}`,
    order.distance_km ? `Distance: ${order.distance_km} km` : null,
    `Amount: ${money(order.total_amount)} (${order.payment_status === 'verified' ? 'paid' : 'collect'})`,
  ].filter(Boolean);

  if (ctx.riderUrl) {
    lines.push('', 'Open your job sheet to update status:', ctx.riderUrl);
  }
  return lines.join('\n');
}

export function customerConfirmationMessage(
  order: Order,
  ctx: OrderMessageContext,
): string {
  return [
    `${ctx.brandName} — order confirmed`,
    '',
    `Order ID: ${order.code}`,
    `Pickup: ${order.pickup_address}`,
    `Delivery: ${order.delivery_address}`,
    `Amount: ${money(order.total_amount)}`,
    order.delivery_otp ? `Delivery OTP: ${order.delivery_otp}` : null,
    '',
    ctx.trackingUrl ? `Track it here: ${ctx.trackingUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function statusUpdateMessage(order: Order, ctx: OrderMessageContext): string {
  const readable: Record<string, string> = {
    confirmed: 'has been confirmed',
    finding_rider: 'is waiting for a rider',
    rider_assigned: 'has a rider assigned',
    picked_up: 'has been picked up',
    out_for_delivery: 'is out for delivery',
    delivered: 'has been delivered',
    cancelled: 'has been cancelled',
  };
  return [
    `${ctx.brandName} — ${order.code}`,
    `Your parcel ${readable[order.status] ?? 'has been updated'}.`,
    ctx.trackingUrl ? '' : null,
    ctx.trackingUrl ?? null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

// ---------------------------------------------------------------------
// Public API — three calls, stable across transports.
// ---------------------------------------------------------------------

export async function sendOrderToRider(
  order: Order,
  rider: Rider,
  ctx: OrderMessageContext,
  countryCode = '91',
): Promise<MessageResult> {
  const to = rider.whatsapp || rider.phone;
  return getTransport().send(to, riderAssignmentMessage(order, ctx), countryCode);
}

export async function sendCustomerUpdate(
  order: Order,
  ctx: OrderMessageContext,
  countryCode = '91',
): Promise<MessageResult> {
  return getTransport().send(
    order.customer_phone,
    statusUpdateMessage(order, ctx),
    countryCode,
  );
}

export async function sendOrderStatus(
  order: Order,
  ctx: OrderMessageContext,
  countryCode = '91',
): Promise<MessageResult> {
  return getTransport().send(
    order.customer_phone,
    customerConfirmationMessage(order, ctx),
    countryCode,
  );
}
