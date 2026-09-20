import { Check, CircleDashed, X } from 'lucide-react';
import type { OrderStatus } from '@/types/database';
import { CUSTOMER_TIMELINE, STATUS_LABELS } from '@/services/orderService';
import { Badge } from './index';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONES: Record<OrderStatus, Parameters<typeof Badge>[0]['tone']> = {
  order_placed: 'neutral',
  confirmed: 'info',
  finding_rider: 'warning',
  rider_assigned: 'info',
  picked_up: 'primary',
  out_for_delivery: 'accent',
  delivered: 'success',
  cancelled: 'danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'verified'
      ? 'success'
      : status === 'submitted'
        ? 'info'
        : status === 'failed'
          ? 'danger'
          : status === 'refunded'
            ? 'neutral'
            : 'warning';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge tone={tone as never}>{label}</Badge>;
}

/**
 * The customer-facing timeline. This is where the design spends its
 * boldness: the dashed road-marking keyline runs down the completed
 * portion of the route, so progress reads as distance covered.
 *
 * It shows recorded status changes only. There is no live GPS here and
 * the UI never implies there is.
 */
export function OrderTimeline({
  status,
  history,
}: {
  status: OrderStatus;
  history: { status: OrderStatus; at: string }[];
}) {
  if (status === 'cancelled') {
    const cancelledAt = history.find((h) => h.status === 'cancelled')?.at;
    return (
      <div className="flex items-start gap-3 rounded-card border border-danger/30 bg-danger/5 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white">
          <X className="h-4 w-4" />
        </span>
        <div>
          <p className="font-medium text-ink">Order cancelled</p>
          {cancelledAt && <p className="mt-0.5 text-sm text-ink-muted">{dateTime(cancelledAt)}</p>}
        </div>
      </div>
    );
  }

  const reached = new Map(history.map((h) => [h.status, h.at]));
  const currentIndex = CUSTOMER_TIMELINE.indexOf(status);

  return (
    <ol className="relative">
      {CUSTOMER_TIMELINE.map((step, index) => {
        const done = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const at = reached.get(step);
        const isLast = index === CUSTOMER_TIMELINE.length - 1;

        return (
          <li key={step} className="relative flex gap-4 pb-7 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-2rem)] w-[3px]',
                  !done && 'bg-line',
                )}
                style={
                  done
                    ? {
                        // Vertical run of the road-marking motif.
                        backgroundImage:
                          'repeating-linear-gradient(to bottom, rgb(var(--color-accent)) 0 10px, transparent 10px 18px)',
                      }
                    : undefined
                }
                aria-hidden
              />
            )}

            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                done
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-surface text-ink-muted',
                isCurrent && 'ring-4 ring-accent/40',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
            </span>

            <div className="min-w-0 pt-1">
              <p className={cn('text-sm font-medium', done ? 'text-ink' : 'text-ink-muted')}>
                {STATUS_LABELS[step]}
              </p>
              {at ? (
                <p className="mt-0.5 text-sm text-ink-muted">{dateTime(at)}</p>
              ) : isCurrent ? (
                <p className="mt-0.5 text-sm text-ink-muted">In progress</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
