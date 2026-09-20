import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Copy, PackageCheck } from 'lucide-react';
import { PageHeader } from '@/components/public/Section';
import { Button, Card, Checkbox, Input, Select, Textarea, Badge } from '@/components/ui';
import { ErrorState, NotConnectedState, SkeletonCard } from '@/components/ui/states';
import { useServiceAreas, usePricingRules, useTimeWindows } from '@/hooks/useCatalog';
import { useSettings } from '@/providers/SettingsProvider';
import { useToast } from '@/providers/ToastProvider';
import { resolveDistance } from '@/services/distanceService';
import { breakdownLines, calculatePrice } from '@/services/pricingEngine';
import { createOrder, type CreateOrderResult } from '@/services/orderService';
import { isSupabaseConfigured } from '@/lib/supabase';
import { money, isoDate, distance as fmtDistance } from '@/lib/format';
import { copyText, cn } from '@/lib/utils';
import type { CustomerType } from '@/types/database';

/**
 * Six steps: pickup, delivery, parcel, schedule, price, payment.
 *
 * The price shown here is a preview. The Edge Function recalculates it
 * from the same engine before the order is written, so a tampered
 * client cannot set its own total — and the amount the customer agreed
 * to is the amount that gets frozen into the snapshot.
 */

const STEPS = ['Pickup', 'Delivery', 'Parcel', 'Schedule', 'Price', 'Payment'] as const;

interface FormState {
  customerName: string;
  customerPhone: string;
  customerType: CustomerType;
  pickupAreaId: string;
  pickupAddress: string;
  pickupLandmark: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAreaId: string;
  deliveryAddress: string;
  deliveryLandmark: string;
  parcelType: string;
  weightKg: string;
  parcelDescription: string;
  isFragile: boolean;
  scheduledDate: string;
  pickupWindowId: string;
  deliveryWindowId: string;
  paymentMethod: 'upi' | 'cash' | 'pay_later';
}

const INITIAL: FormState = {
  customerName: '', customerPhone: '', customerType: 'individual',
  pickupAreaId: '', pickupAddress: '', pickupLandmark: '',
  receiverName: '', receiverPhone: '', deliveryAreaId: '', deliveryAddress: '', deliveryLandmark: '',
  parcelType: '', weightKg: '', parcelDescription: '', isFragile: false,
  scheduledDate: '', pickupWindowId: '', deliveryWindowId: '',
  paymentMethod: 'cash',
};

function StepBar({ current }: { current: number }) {
  return (
    <ol className="hide-scrollbar mb-7 flex gap-1 overflow-x-auto">
      {STEPS.map((label, i) => (
        <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              i < current ? 'bg-primary text-white'
                : i === current ? 'bg-accent text-primary-dark'
                : 'bg-line text-ink-muted',
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cn('hidden truncate text-xs sm:block',
            i === current ? 'font-medium text-ink' : 'text-ink-muted')}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function BookCourier() {
  const { settings } = useSettings();
  const toast = useToast();
  const areas = useServiceAreas();
  const rules = usePricingRules();
  const pickupWindows = useTimeWindows('pickup');
  const deliveryWindows = useTimeWindows('delivery');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<CreateOrderResult | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const distanceQuery = useQuery({
    queryKey: ['distance', form.pickupAreaId, form.deliveryAreaId],
    enabled: Boolean(form.pickupAreaId && form.deliveryAreaId),
    queryFn: () => resolveDistance(form.pickupAreaId, form.deliveryAreaId),
  });

  const quote = useMemo(() => {
    if (!rules.data || !form.weightKg) return null;
    return calculatePrice(
      {
        weightKg: Number(form.weightKg),
        distanceKm: distanceQuery.data?.km ?? null,
        customerType: form.customerType,
        distanceSource: distanceQuery.data?.source,
      },
      rules.data,
      { areaId: form.deliveryAreaId },
    );
  }, [rules.data, form.weightKg, form.customerType, form.deliveryAreaId, distanceQuery.data]);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(form.customerName && form.customerPhone.length >= 10
          && form.pickupAreaId && form.pickupAddress);
      case 1:
        return Boolean(form.receiverName && form.deliveryAreaId && form.deliveryAddress
          && (!settings.booking.requireReceiverPhone || form.receiverPhone.length >= 10));
      case 2:
        return Boolean(form.parcelType && Number(form.weightKg) > 0);
      case 3:
        return true;
      case 4:
        return Boolean(quote?.ok);
      default:
        return true;
    }
  }, [step, form, quote, settings.booking.requireReceiverPhone]);

  async function submit() {
    setSubmitting(true);
    try {
      const result = await createOrder({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerType: form.customerType,
        pickupAreaId: form.pickupAreaId,
        pickupAddress: form.pickupAddress,
        pickupLandmark: form.pickupLandmark || undefined,
        deliveryAreaId: form.deliveryAreaId,
        deliveryAddress: form.deliveryAddress,
        deliveryLandmark: form.deliveryLandmark || undefined,
        receiverName: form.receiverName,
        receiverPhone: form.receiverPhone,
        parcelType: form.parcelType,
        weightKg: Number(form.weightKg),
        parcelDescription: form.parcelDescription || undefined,
        isFragile: form.isFragile,
        scheduledDate: form.scheduledDate || null,
        pickupWindowId: form.pickupWindowId || null,
        deliveryWindowId: form.deliveryWindowId || null,
        paymentMethod: form.paymentMethod,
      });
      setPlaced(result);
    } catch (err) {
      toast.error(
        'The order could not be placed',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Book a pickup" />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card><NotConnectedState /></Card>
        </div>
      </>
    );
  }

  if (placed) {
    return (
      <>
        <PageHeader title="Order placed" />
        <div className="mx-auto max-w-2xl px-4 py-10">
          <Card className="p-6 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <PackageCheck className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-ink">Your pickup is booked</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Save this order ID — you need it, with your phone number, to track the parcel.
            </p>

            <div className="mt-6 rounded-card border border-line bg-canvas p-5">
              <p className="text-sm text-ink-muted">Order ID</p>
              <p className="mt-1 font-mono text-2xl font-bold text-ink">{placed.code}</p>
              <Button
                variant="outline" size="sm" className="mt-3"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={async () => {
                  const ok = await copyText(placed.code);
                  ok ? toast.success('Order ID copied') : toast.error('Could not copy');
                }}
              >
                Copy
              </Button>
            </div>

            <div className="mt-4 rounded-card border border-accent/40 bg-accent/10 p-5">
              <p className="text-sm text-ink-muted">Delivery OTP</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-ink">
                {placed.deliveryOtp}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Give this to the rider at delivery. Do not share it before then.
              </p>
            </div>

            <p className="mt-5 text-lg font-semibold text-ink">{money(placed.totalAmount)}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to={`/track?order=${placed.code}`}>
                <Button size="lg" fullWidth>Track this order</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" size="lg" fullWidth>Back to home</Button>
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (areas.error) {
    return (
      <>
        <PageHeader title="Book a pickup" />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card><ErrorState error={areas.error} onRetry={() => areas.refetch()} /></Card>
        </div>
      </>
    );
  }

  const areaOptions = areas.data ?? [];

  return (
    <>
      <PageHeader title="Book a pickup" description="Six short steps. It takes about a minute." />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <StepBar current={step} />

        <Card className="p-5 sm:p-6">
          {areas.isLoading ? (
            <SkeletonCard className="border-0 shadow-none" />
          ) : areaOptions.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              Service areas have not been set up yet, so booking is not available.
              {settings.contact.phone && ` Call ${settings.contact.phone} to arrange a pickup.`}
            </p>
          ) : (
            <>
              {step === 0 && (
                <div className="grid gap-4">
                  <h2 className="text-base font-semibold text-ink">Where should we collect from?</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Your name" value={form.customerName}
                      onChange={(e) => set('customerName', e.target.value)} required />
                    <Input label="Your phone" inputMode="tel" prefix={`+${settings.contact.countryCode}`}
                      value={form.customerPhone}
                      onChange={(e) => set('customerPhone', e.target.value.replace(/\D/g, ''))}
                      maxLength={10} required />
                  </div>
                  <Select label="Pickup area" placeholder="Select an area" value={form.pickupAreaId}
                    onChange={(e) => set('pickupAreaId', e.target.value)} required>
                    {areaOptions.filter((a) => a.pickup_available).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                  <Textarea label="Pickup address" value={form.pickupAddress}
                    onChange={(e) => set('pickupAddress', e.target.value)}
                    placeholder="House or shop number, street, locality" required />
                  <Input label="Landmark" hint="Optional, but it helps the rider find you"
                    value={form.pickupLandmark} onChange={(e) => set('pickupLandmark', e.target.value)} />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4">
                  <h2 className="text-base font-semibold text-ink">Where is it going?</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Receiver name" value={form.receiverName}
                      onChange={(e) => set('receiverName', e.target.value)} required />
                    <Input label="Receiver phone" inputMode="tel"
                      prefix={`+${settings.contact.countryCode}`} value={form.receiverPhone}
                      onChange={(e) => set('receiverPhone', e.target.value.replace(/\D/g, ''))}
                      maxLength={10} required={settings.booking.requireReceiverPhone} />
                  </div>
                  <Select label="Delivery area" placeholder="Select an area" value={form.deliveryAreaId}
                    onChange={(e) => set('deliveryAreaId', e.target.value)} required>
                    {areaOptions.filter((a) => a.delivery_available).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                  <Textarea label="Delivery address" value={form.deliveryAddress}
                    onChange={(e) => set('deliveryAddress', e.target.value)} required />
                  <Input label="Landmark" value={form.deliveryLandmark}
                    onChange={(e) => set('deliveryLandmark', e.target.value)} />
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4">
                  <h2 className="text-base font-semibold text-ink">What are you sending?</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Parcel type" placeholder="Select a type" value={form.parcelType}
                      onChange={(e) => set('parcelType', e.target.value)} required>
                      {settings.booking.parcelTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                    <Input label="Weight" type="number" inputMode="decimal" min="0" step="0.1"
                      value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)}
                      hint={settings.booking.maxWeightKg > 0
                        ? `In kilograms, up to ${settings.booking.maxWeightKg} kg`
                        : 'In kilograms'}
                      required />
                  </div>
                  <Textarea label="What is inside" hint="Optional"
                    value={form.parcelDescription}
                    onChange={(e) => set('parcelDescription', e.target.value)} />
                  <Checkbox label="This parcel is fragile"
                    description="The rider will be told to handle it carefully."
                    checked={form.isFragile}
                    onChange={(e) => set('isFragile', e.target.checked)} />
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4">
                  <h2 className="text-base font-semibold text-ink">When suits you?</h2>
                  <Input label="Pickup date" type="date" value={form.scheduledDate}
                    min={isoDate(new Date())} onChange={(e) => set('scheduledDate', e.target.value)}
                    hint="Leave blank for the earliest available slot" />
                  {(pickupWindows.data ?? []).length > 0 && (
                    <Select label="Pickup window" placeholder="Any time"
                      value={form.pickupWindowId} onChange={(e) => set('pickupWindowId', e.target.value)}>
                      {(pickupWindows.data ?? []).map((w) => (
                        <option key={w.id} value={w.id}>{w.label}</option>
                      ))}
                    </Select>
                  )}
                  {(deliveryWindows.data ?? []).length > 0 && (
                    <Select label="Delivery window" placeholder="Any time"
                      value={form.deliveryWindowId} onChange={(e) => set('deliveryWindowId', e.target.value)}>
                      {(deliveryWindows.data ?? []).map((w) => (
                        <option key={w.id} value={w.id}>{w.label}</option>
                      ))}
                    </Select>
                  )}
                  {(pickupWindows.data ?? []).length === 0 && (deliveryWindows.data ?? []).length === 0 && (
                    <p className="text-sm text-ink-muted">
                      Time windows have not been set up, so we will confirm timing with you directly.
                    </p>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-4">
                  <h2 className="text-base font-semibold text-ink">Your price</h2>
                  {distanceQuery.data?.km !== null && distanceQuery.data && (
                    <p className="text-sm text-ink-muted">
                      Distance: {fmtDistance(distanceQuery.data.km)}
                    </p>
                  )}
                  {!quote ? (
                    <SkeletonCard className="border-0 shadow-none" />
                  ) : !quote.ok ? (
                    <div className="rounded-card bg-warning/10 p-4">
                      <p className="text-sm leading-relaxed text-warning">{quote.message}</p>
                      {settings.contact.phone && (
                        <p className="mt-2 text-sm text-ink-muted">
                          Call {settings.contact.phone} and we will quote it for you.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-card border border-line bg-canvas p-5">
                      <dl className="space-y-2.5 text-sm">
                        {breakdownLines(quote.snapshot).map((line) => (
                          <div key={line.label} className="flex justify-between gap-4">
                            <dt className="text-ink-muted">{line.label}</dt>
                            <dd className={line.amount < 0 ? 'text-success' : 'text-ink'}>
                              {line.muted ? '—' : money(line.amount)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                        <span className="font-medium text-ink">Total</span>
                        <span className="font-display text-2xl font-bold text-ink">
                          {money(quote.snapshot.finalAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="grid gap-4">
                  <h2 className="text-base font-semibold text-ink">How would you like to pay?</h2>
                  <div className="grid gap-3">
                    {settings.payments.onlineEnabled && settings.payments.upiId && (
                      <Checkbox
                        label="Pay by UPI" description="You will see the QR and UPI ID after booking."
                        checked={form.paymentMethod === 'upi'}
                        onChange={() => set('paymentMethod', 'upi')} />
                    )}
                    {settings.payments.cashEnabled && (
                      <Checkbox label="Cash" description="Pay the rider at pickup or delivery."
                        checked={form.paymentMethod === 'cash'}
                        onChange={() => set('paymentMethod', 'cash')} />
                    )}
                    {settings.payments.payLaterEnabled && (
                      <Checkbox label="Pay later" description="Settle this on your account."
                        checked={form.paymentMethod === 'pay_later'}
                        onChange={() => set('paymentMethod', 'pay_later')} />
                    )}
                  </div>
                  {settings.payments.instructions && (
                    <p className="rounded-card bg-canvas p-4 text-sm leading-relaxed text-ink-muted">
                      {settings.payments.instructions}
                    </p>
                  )}
                  {quote?.ok && (
                    <div className="flex items-center justify-between rounded-card border border-line p-4">
                      <span className="text-sm text-ink-muted">Amount</span>
                      <span className="text-lg font-semibold text-ink">
                        {money(quote.snapshot.finalAmount)}
                      </span>
                    </div>
                  )}
                  <p className="text-xs leading-relaxed text-ink-muted">
                    Payment is confirmed manually once received. Nothing is charged automatically.
                  </p>
                </div>
              )}

              <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
                <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}
                  icon={<ArrowLeft className="h-4 w-4" />}>
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="accent" size="lg" loading={submitting}
                    disabled={!quote?.ok} onClick={submit}>
                    Place order
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>

        {quote?.ok && step < 4 && (
          <p className="mt-4 text-center text-sm text-ink-muted">
            Current estimate <Badge tone="accent">{money(quote.snapshot.finalAmount)}</Badge>
          </p>
        )}
      </div>
    </>
  );
}
