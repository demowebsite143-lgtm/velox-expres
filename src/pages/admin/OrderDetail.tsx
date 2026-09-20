import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Bike, Check, MessageCircle, Navigation, Package, Phone,
  ShieldCheck, User, X,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, Divider, Select, Spinner, Textarea } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { ErrorState, NotConnectedState } from '@/components/ui/states';
import { OrderStatusBadge, OrderTimeline, PaymentStatusBadge } from '@/components/ui/OrderStatus';
import {
  getOrder, getStatusHistory, setInternalNotes, STATUS_FLOW, STATUS_LABELS,
  updateOrderStatus, updatePaymentStatus,
} from '@/services/orderService';
import {
  claimOrder, dispatchOrder, notifyRider, releaseOrder, riderPortalUrl, trackingUrl,
  type DispatchCandidates,
} from '@/services/dispatchService';
import { sendCustomerUpdate } from '@/services/whatsappService';
import { useSettings } from '@/providers/SettingsProvider';
import { useToast } from '@/providers/ToastProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { breakdownLines } from '@/services/pricingEngine';
import { money, weight as fmtWeight, dateTime } from '@/lib/format';
import { mapsDirectionsLink, telLink } from '@/lib/utils';
import type { OrderStatus, PaymentStatus, Rider } from '@/types/database';
import type { ReactNode } from 'react';

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['submitted', 'verified', 'failed'],
  submitted: ['verified', 'failed'],
  verified: ['refunded'],
  failed: ['pending'],
  refunded: [],
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { settings, brandName } = useSettings();

  const orderQuery = useQuery({
    queryKey: ['admin', 'order', id],
    enabled: isSupabaseConfigured && Boolean(id),
    queryFn: () => getOrder(id!),
  });

  const historyQuery = useQuery({
    queryKey: ['admin', 'order-history', id],
    enabled: isSupabaseConfigured && Boolean(id),
    queryFn: () => getStatusHistory(id!),
  });

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [candidates, setCandidates] = useState<DispatchCandidates | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [claimingRiderId, setClaimingRiderId] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const order = orderQuery.data;

  useEffect(() => {
    setNotes(order?.internal_notes ?? '');
  }, [order?.internal_notes]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'order-history', id] }),
    ]);
  }, [queryClient, id]);

  if (!isSupabaseConfigured) {
    return <Card><NotConnectedState /></Card>;
  }

  if (orderQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (orderQuery.error || !order) {
    return (
      <Card>
        <ErrorState error={orderQuery.error ?? new Error('Order not found')} onRetry={() => orderQuery.refetch()} />
      </Card>
    );
  }

  const history = (historyQuery.data ?? []).map((h) => ({ status: h.status, at: h.created_at }));
  const nextStatuses = STATUS_FLOW[order.status];
  const canDispatch = ['order_placed', 'confirmed', 'finding_rider'].includes(order.status) && !order.rider_id;
  const isTerminal = order.status === 'delivered' || order.status === 'cancelled';

  async function setStatus(next: OrderStatus) {
    setStatusBusy(true);
    try {
      await updateOrderStatus(order!.id, next);
      await refresh();
      toast.success(`Order marked ${STATUS_LABELS[next].toLowerCase()}`);
    } catch (err) {
      toast.error('Could not update status', err instanceof Error ? err.message : undefined);
    } finally {
      setStatusBusy(false);
    }
  }

  async function confirmCancel() {
    setStatusBusy(true);
    try {
      await updateOrderStatus(order!.id, 'cancelled', cancelReason.trim() || undefined);
      await refresh();
      toast.success('Order cancelled');
      setCancelOpen(false);
      setCancelReason('');
    } catch (err) {
      toast.error('Could not cancel order', err instanceof Error ? err.message : undefined);
    } finally {
      setStatusBusy(false);
    }
  }

  async function openDispatch() {
    setDispatchOpen(true);
    setLoadingCandidates(true);
    try {
      const result = await dispatchOrder(order!);
      setCandidates(result);
    } catch (err) {
      toast.error('Could not load riders', err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function assignRider(rider: Rider) {
    setClaimingRiderId(rider.id);
    try {
      const result = await claimOrder(order!.id, rider.id);
      if (!result.claimed) {
        toast.error('That order was already assigned to someone else');
        setDispatchOpen(false);
        await refresh();
        return;
      }

      await refresh();
      setDispatchOpen(false);
      toast.success(`Assigned to ${rider.name}`);

      if (result.riderToken) {
        const message = await notifyRider(
          { ...order!, rider_id: rider.id, rider_token: result.riderToken },
          rider,
          {
            brandName,
            pickupArea: order!.pickup_area?.name ? { name: order!.pickup_area.name } : null,
            riderUrl: riderPortalUrl(result.riderToken),
          },
          settings.contact.countryCode,
        );
        if (message.url) window.open(message.url, '_blank');
      }
    } catch (err) {
      toast.error('Could not assign rider', err instanceof Error ? err.message : undefined);
    } finally {
      setClaimingRiderId(null);
    }
  }

  async function confirmRelease() {
    setReleasing(true);
    try {
      await releaseOrder(order!.id);
      await refresh();
      toast.success('Rider unassigned — order is back to finding a rider');
      setReleaseOpen(false);
    } catch (err) {
      toast.error('Could not unassign rider', err instanceof Error ? err.message : undefined);
    } finally {
      setReleasing(false);
    }
  }

  async function messageCustomer() {
    try {
      const result = await sendCustomerUpdate(
        order,
        { brandName, trackingUrl: trackingUrl(order.code) },
        settings.contact.countryCode,
      );
      if (result.url) window.open(result.url, '_blank');
    } catch (err) {
      toast.error('Could not open WhatsApp', err instanceof Error ? err.message : undefined);
    }
  }

  async function onPaymentChange(next: PaymentStatus) {
    try {
      await updatePaymentStatus(order.id, next);
      await refresh();
      toast.success(`Payment marked ${next}`);
    } catch (err) {
      toast.error('Could not update payment', err instanceof Error ? err.message : undefined);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await setInternalNotes(order.id, notes);
      await refresh();
      toast.success('Notes saved');
    } catch (err) {
      toast.error('Could not save notes', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button
        onClick={() => navigate('/admin/orders')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All orders
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-ink-muted">{order.code}</p>
          <h1 className="mt-1 text-display-sm">{order.customer_name}</h1>
          <p className="mt-1 text-sm text-ink-muted">Placed {dateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Status controls */}
          <Card>
            <CardHeader
              title="Status"
              description={isTerminal ? 'This order is closed.' : 'Move the order forward or cancel it.'}
            />
            <div className="flex flex-wrap gap-2 p-4 sm:p-5">
              {nextStatuses.filter((s) => s !== 'cancelled').map((s) => (
                <Button key={s} size="sm" loading={statusBusy} onClick={() => setStatus(s)}>
                  {STATUS_LABELS[s]}
                </Button>
              ))}
              {nextStatuses.includes('cancelled') && (
                <Button size="sm" variant="danger" icon={<X className="h-3.5 w-3.5" />} onClick={() => setCancelOpen(true)}>
                  Cancel order
                </Button>
              )}
              {nextStatuses.length === 0 && (
                <p className="text-sm text-ink-muted">No further status changes are available.</p>
              )}
            </div>
          </Card>

          {/* Rider / dispatch */}
          <Card>
            <CardHeader
              title="Rider"
              action={
                canDispatch ? (
                  <Button size="sm" icon={<Bike className="h-3.5 w-3.5" />} onClick={openDispatch}>
                    Find rider
                  </Button>
                ) : order.rider_id && order.status === 'rider_assigned' ? (
                  <Button size="sm" variant="outline" onClick={() => setReleaseOpen(true)}>
                    Unassign
                  </Button>
                ) : undefined
              }
            />
            <div className="p-4 sm:p-5">
              {order.rider ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{order.rider.name}</p>
                      <p className="text-sm text-ink-muted">{order.rider.phone}</p>
                    </div>
                  </div>
                  <a href={telLink(order.rider.phone, settings.contact.countryCode)}>
                    <Button variant="outline" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>Call</Button>
                  </a>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  {canDispatch ? 'No rider assigned yet.' : 'This order was never assigned a rider.'}
                </p>
              )}
            </div>
          </Card>

          {/* Pickup / delivery */}
          <Card>
            <CardHeader title="Pickup & delivery" />
            <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Pickup</p>
                <p className="font-medium text-ink">{order.customer_name}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{order.pickup_address}</p>
                {order.pickup_landmark && <p className="text-sm text-ink-muted">Landmark: {order.pickup_landmark}</p>}
                {order.pickup_area?.name && <Badge tone="primary" className="mt-2">{order.pickup_area.name}</Badge>}
                <div className="mt-3 flex gap-2">
                  <a href={telLink(order.customer_phone, settings.contact.countryCode)}>
                    <Button variant="outline" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>Call</Button>
                  </a>
                  <a
                    href={mapsDirectionsLink(`${order.pickup_address} ${order.pickup_area?.name ?? ''}`)}
                    target="_blank" rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" icon={<Navigation className="h-3.5 w-3.5" />}>Map</Button>
                  </a>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Delivery</p>
                <p className="font-medium text-ink">{order.receiver_name}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{order.delivery_address}</p>
                {order.delivery_landmark && <p className="text-sm text-ink-muted">Landmark: {order.delivery_landmark}</p>}
                {order.delivery_area?.name && <Badge tone="primary" className="mt-2">{order.delivery_area.name}</Badge>}
                <div className="mt-3 flex gap-2">
                  <a href={telLink(order.receiver_phone, settings.contact.countryCode)}>
                    <Button variant="outline" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>Call</Button>
                  </a>
                  <a
                    href={mapsDirectionsLink(`${order.delivery_address} ${order.delivery_area?.name ?? ''}`)}
                    target="_blank" rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" icon={<Navigation className="h-3.5 w-3.5" />}>Map</Button>
                  </a>
                </div>
              </div>
            </div>
          </Card>

          {/* Parcel */}
          <Card>
            <CardHeader title="Parcel" />
            <div className="flex items-start gap-3 p-4 sm:p-5">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
              <div>
                <p className="font-medium text-ink">{order.parcel_type} · {fmtWeight(order.weight_kg)}</p>
                {order.parcel_description && (
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{order.parcel_description}</p>
                )}
                {order.is_fragile && <Badge tone="warning" className="mt-2">Fragile</Badge>}
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="History" />
            <div className="p-4 sm:p-5">
              {historyQuery.isLoading ? <Spinner /> : <OrderTimeline status={order.status} history={history} />}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader title="Internal notes" description="Only visible to admins — never shown to the customer or rider." />
            <div className="space-y-3 p-4 sm:p-5">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              <Button size="sm" onClick={saveNotes} loading={savingNotes} disabled={notes === (order.internal_notes ?? '')}>
                Save notes
              </Button>
            </div>
          </Card>
        </div>

        {/* Sidebar: price + payment */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Price" description="Frozen at booking — never affected by later rate changes." />
            <div className="p-4 sm:p-5">
              <dl className="space-y-2 text-sm">
                {breakdownLines(order.price_snapshot).map((line) => (
                  <div key={line.label} className="flex justify-between gap-4">
                    <dt className="text-ink-muted">{line.label}</dt>
                    <dd className={line.amount < 0 ? 'text-success' : 'text-ink'}>
                      {line.muted ? '—' : money(line.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
              <Divider className="my-3" />
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-ink">Total</span>
                <span className="font-display text-xl font-bold text-ink">{money(Number(order.total_amount))}</span>
              </div>
              {order.distance_km !== null && <InfoRow label="Distance" value={`${order.distance_km} km`} />}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <div className="space-y-3 p-4 sm:p-5">
              <InfoRow label="Method" value={<span className="capitalize">{order.payment_method.replace('_', ' ')}</span>} />
              <InfoRow label="Status" value={<PaymentStatusBadge status={order.payment_status} />} />

              {PAYMENT_TRANSITIONS[order.payment_status].length > 0 && (
                <Select
                  label="Update payment status"
                  value=""
                  onChange={(e) => e.target.value && onPaymentChange(e.target.value as PaymentStatus)}
                >
                  <option value="">Choose a status…</option>
                  {PAYMENT_TRANSITIONS[order.payment_status].map((s) => (
                    <option key={s} value={s}>Mark as {s}</option>
                  ))}
                </Select>
              )}

              {order.payment_status === 'submitted' && (
                <div className="flex items-center gap-2 rounded-card bg-info/10 p-3 text-sm text-info">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  A reference was submitted. Confirm it arrived before marking verified.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-1 p-4 sm:p-5">
              <InfoRow label="Name" value={order.customer_name} />
              <InfoRow label="Phone" value={order.customer_phone} />
              <InfoRow label="Type" value={<span className="capitalize">{order.customer_type}</span>} />
              <Button
                variant="outline" size="sm" fullWidth className="mt-2"
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                onClick={messageCustomer}
              >
                Message on WhatsApp
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Dispatch modal */}
      <Modal
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        title="Assign a rider"
        description="First to be claimed gets it — two admins cannot assign the same order twice."
      >
        {loadingCandidates ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !candidates || candidates.riders.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            {candidates?.note ?? 'No riders available.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {candidates.riders.map((rider) => (
              <li key={rider.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">{rider.name}</p>
                  <p className="text-sm text-ink-muted">
                    {rider.phone}
                    {rider.service_area_id === candidates.preferredAreaId && (
                      <Badge tone="success" className="ml-2">Same area</Badge>
                    )}
                    {rider.availability === 'busy' && <Badge tone="warning" className="ml-2">Busy</Badge>}
                  </p>
                </div>
                <Button
                  size="sm"
                  loading={claimingRiderId === rider.id}
                  disabled={Boolean(claimingRiderId)}
                  onClick={() => assignRider(rider)}
                  icon={<Check className="h-3.5 w-3.5" />}
                >
                  Assign
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        onConfirm={confirmRelease}
        title="Unassign this rider?"
        message="The order goes back to Finding rider and can be assigned to someone else."
        confirmLabel="Unassign"
        tone="danger"
        loading={releasing}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button variant="danger" onClick={confirmCancel} loading={statusBusy}>Cancel order</Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          hint="Optional, kept as an internal note"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
