import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, Phone, ShieldQuestion } from 'lucide-react';
import { PageHeader } from '@/components/public/Section';
import { Button, Card, Input } from '@/components/ui';
import { OrderTimeline, PaymentStatusBadge } from '@/components/ui/OrderStatus';
import { EmptyState } from '@/components/ui/states';
import { trackOrder } from '@/services/orderService';
import { useSettings } from '@/providers/SettingsProvider';
import { money, shortDate, weight as fmtWeight } from '@/lib/format';
import type { TrackingResult } from '@/types/database';

/**
 * Customer tracking.
 *
 * Order ID plus phone, checked server-side by a security-definer
 * function that returns a narrowed payload. There is no table read here
 * and no RLS policy that would allow one.
 *
 * This shows recorded status changes. It does not show live location,
 * and nothing on the page suggests it does.
 */
export default function TrackOrder() {
  const [params] = useSearchParams();
  const { settings, callHref } = useSettings();

  const [code, setCode] = useState(params.get('order') ?? '');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'not_found' | 'error' | 'found'>(
    'idle',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fromUrl = params.get('order');
    if (fromUrl) setCode(fromUrl);
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const found = await trackOrder(code, phone);
      if (!found) {
        setResult(null);
        setStatus('not_found');
        return;
      }
      setResult(found);
      setStatus('found');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not check that right now.');
    }
  }

  return (
    <>
      <PageHeader
        title="Track your order"
        description="Enter the order ID from your confirmation along with the phone number you booked with."
      />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="p-5 sm:p-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input
              label="Order ID"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VLX-000000-0000"
              autoComplete="off"
              required
            />
            <Input
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Booking phone number"
              required
            />
            <Button
              type="submit"
              size="lg"
              loading={status === 'loading'}
              className="sm:mb-0"
            >
              Track
            </Button>
          </form>

          {status === 'error' && (
            <p className="mt-4 rounded-card bg-danger/10 p-3.5 text-sm text-danger">{message}</p>
          )}
        </Card>

        {status === 'not_found' && (
          <Card className="mt-6">
            <EmptyState
              icon={<ShieldQuestion className="h-6 w-6" />}
              title="No order matches those details"
              description="Check the order ID and make sure the phone number is the one used at booking."
              action={
                settings.contact.phone ? (
                  <a href={callHref}>
                    <Button variant="outline" icon={<Phone className="h-4 w-4" />}>
                      Call us
                    </Button>
                  </a>
                ) : undefined
              }
            />
          </Card>
        )}

        {status === 'found' && result && (
          <div className="mt-6 grid gap-5">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm text-ink-muted">{result.code}</p>
                  <h2 className="mt-1 text-xl font-semibold text-ink">
                    To {result.receiver_name}
                    {result.delivery_area ? `, ${result.delivery_area}` : ''}
                  </h2>
                </div>
                <PaymentStatusBadge status={result.payment_status} />
              </div>

              <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-ink-muted">Booked</dt>
                  <dd className="text-ink sm:mt-0.5">{shortDate(result.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-ink-muted">Parcel</dt>
                  <dd className="text-ink sm:mt-0.5">
                    {result.parcel_type} · {fmtWeight(result.weight_kg)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-ink-muted">Amount</dt>
                  <dd className="text-ink sm:mt-0.5">{money(result.total_amount)}</dd>
                </div>
                {result.rider_name && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-ink-muted">Rider</dt>
                    <dd className="text-ink sm:mt-0.5">{result.rider_name}</dd>
                  </div>
                )}
              </dl>

              {result.delivery_otp && (
                <div className="mt-5 rounded-card border border-accent/40 bg-accent/10 p-4">
                  <p className="text-sm text-ink-muted">Give this OTP to the rider at delivery</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-ink">
                    {result.delivery_otp}
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <h3 className="mb-5 text-base font-semibold text-ink">Progress</h3>
              <OrderTimeline status={result.status} history={result.history} />
              <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
                <PackageSearch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                These are the status updates recorded for your parcel. Live map tracking is
                not available.
              </p>
            </Card>
          </div>
        )}

        {status === 'idle' && (
          <p className="mt-6 text-center text-sm text-ink-muted">
            Your order ID was sent to you when the booking was confirmed.
          </p>
        )}
      </div>
    </>
  );
}
