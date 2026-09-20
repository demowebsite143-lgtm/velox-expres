import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  MapPin,
  Navigation,
  Package,
  Phone,
} from 'lucide-react';
import { Button, Card, Input, Badge, RouteRule, Spinner } from '@/components/ui';
import { OrderStatusBadge } from '@/components/ui/OrderStatus';
import { callFunction } from '@/lib/supabase';
import { useSettings } from '@/providers/SettingsProvider';
import { money, weight as fmtWeight, shortDate } from '@/lib/format';
import { mapsDirectionsLink, telLink } from '@/lib/utils';
import type { OrderStatus, RiderOrderView } from '@/types/database';

/**
 * The rider's job sheet.
 *
 * No account, no app install, no admin access. The link itself is the
 * credential: one opaque token, one order, dead the moment the parcel
 * is delivered or the order is cancelled.
 *
 * Designed for one hand, outdoors, on a cheap phone: large targets, one
 * action visible at a time, and the next step always at the bottom
 * where the thumb is.
 */

const NEXT_ACTION: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  rider_assigned: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'out_for_delivery', label: 'Start delivery' },
  out_for_delivery: { next: 'delivered', label: 'Mark delivered' },
};

export default function RiderOrder() {
  const { token } = useParams<{ token: string }>();
  const { settings, brandName } = useSettings();

  const [order, setOrder] = useState<RiderOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callFunction<RiderOrderView>('rider-portal', { action: 'get', token });
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This link could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function advance(next: OrderStatus) {
    setBusy(true);
    setActionError(null);
    try {
      await callFunction('rider-portal', {
        action: 'advance',
        token,
        next,
        otp: next === 'delivered' ? otp : undefined,
      });
      if (next === 'delivered') {
        setDone(true);
      } else {
        await load();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the order.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-ink">Delivery confirmed</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          This job is closed and the link has expired. Thanks.
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
          <AlertTriangle className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-ink">This link is not active</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          {error ?? 'It may already be delivered, cancelled, or reassigned.'}
          {settings.contact.phone && ` Call ${settings.contact.phone} if you need this order.`}
        </p>
      </div>
    );
  }

  const action = NEXT_ACTION[order.status];
  const target = order.status === 'rider_assigned' ? 'pickup' : 'delivery';
  const navQuery =
    target === 'pickup'
      ? `${order.pickup_address} ${order.pickup_area ?? ''}`
      : `${order.delivery_address} ${order.delivery_area ?? ''}`;

  return (
    <div className="min-h-screen bg-canvas pb-40">
      <header
        className="bg-primary px-5 pb-5 pt-5 text-white"
        style={{ paddingTop: 'calc(1.25rem + var(--safe-top))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/60">{brandName}</p>
            <p className="mt-0.5 font-mono text-lg font-bold">{order.code}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        {order.rider_name && (
          <p className="mt-3 text-sm text-white/70">Assigned to {order.rider_name}</p>
        )}
      </header>
      <RouteRule />

      <div className="space-y-4 p-4">
        {/* Whichever address matters right now comes first. */}
        <Card className="border-accent/50 p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent-dark" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {target === 'pickup' ? 'Collect from' : 'Deliver to'}
            </h2>
          </div>
          <p className="mt-2 text-base font-medium leading-relaxed text-ink">
            {target === 'pickup' ? order.pickup_address : order.delivery_address}
          </p>
          {(target === 'pickup' ? order.pickup_landmark : order.delivery_landmark) && (
            <p className="mt-1 text-sm text-ink-muted">
              Landmark: {target === 'pickup' ? order.pickup_landmark : order.delivery_landmark}
            </p>
          )}
          {(target === 'pickup' ? order.pickup_area : order.delivery_area) && (
            <Badge tone="primary" className="mt-3">
              {target === 'pickup' ? order.pickup_area : order.delivery_area}
            </Badge>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={telLink(
                target === 'pickup' ? order.customer_phone : order.receiver_phone,
                settings.contact.countryCode,
              )}
            >
              <Button variant="outline" size="lg" fullWidth icon={<Phone className="h-4 w-4" />}>
                Call
              </Button>
            </a>
            <a href={mapsDirectionsLink(navQuery)} target="_blank" rel="noreferrer">
              <Button variant="outline" size="lg" fullWidth icon={<Navigation className="h-4 w-4" />}>
                Navigate
              </Button>
            </a>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Parcel</h2>
          <div className="mt-3 flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {order.parcel_type} · {fmtWeight(order.weight_kg)}
              </p>
              {order.parcel_description && (
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {order.parcel_description}
                </p>
              )}
              {order.is_fragile && (
                <Badge tone="warning" className="mt-2">
                  Fragile — handle with care
                </Badge>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Both addresses
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted">Sender — {order.customer_name}</dt>
              <dd className="mt-0.5 leading-relaxed text-ink">{order.pickup_address}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Receiver — {order.receiver_name}</dt>
              <dd className="mt-0.5 leading-relaxed text-ink">{order.delivery_address}</dd>
            </div>
            {order.scheduled_date && (
              <div>
                <dt className="text-ink-muted">Scheduled</dt>
                <dd className="mt-0.5 text-ink">{shortDate(order.scheduled_date)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card
          className={
            order.payment_status === 'verified' ? 'p-4' : 'border-warning/40 bg-warning/5 p-4'
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-muted">
                {order.payment_status === 'verified' ? 'Already paid' : 'Collect from customer'}
              </p>
              <p className="mt-0.5 text-xl font-bold text-ink">{money(order.total_amount)}</p>
            </div>
            <Badge tone={order.payment_status === 'verified' ? 'success' : 'warning'}>
              {order.payment_method.replace('_', ' ')}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Action dock. One decision, always within thumb reach. */}
      {action && (
        <div
          className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-4 shadow-lift"
          style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
        >
          {action.next === 'delivered' && (
            <div className="mb-3">
              <Input
                label="Delivery OTP"
                inputMode="numeric"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit code from the receiver"
                className="text-center font-mono text-xl tracking-[0.4em]"
              />
            </div>
          )}

          {actionError && (
            <p className="mb-3 rounded-card bg-danger/10 p-3 text-sm text-danger">{actionError}</p>
          )}

          <Button
            variant="accent"
            size="lg"
            fullWidth
            loading={busy}
            disabled={action.next === 'delivered' && otp.length !== 4}
            onClick={() => advance(action.next)}
          >
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
