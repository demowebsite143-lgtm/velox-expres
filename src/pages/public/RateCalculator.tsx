import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/public/Section';
import { Button, Card, Select, Input, Badge } from '@/components/ui';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { usePricingRules, useServiceAreas } from '@/hooks/useCatalog';
import { useSettings } from '@/providers/SettingsProvider';
import { resolveDistance } from '@/services/distanceService';
import { calculatePrice, breakdownLines } from '@/services/pricingEngine';
import { money, distance as fmtDistance } from '@/lib/format';
import type { CustomerType } from '@/types/database';

/**
 * The public rate calculator.
 *
 * Not one price is written in this file. Rules come from the admin rate
 * chart, distance from the admin area matrix, and the arithmetic from
 * the shared pricing engine. With no rules configured it says pricing
 * is unavailable rather than showing a number.
 */
export default function RateCalculator() {
  const { settings } = useSettings();
  const areas = useServiceAreas();
  const rules = usePricingRules();

  const [fromArea, setFromArea] = useState('');
  const [toArea, setToArea] = useState('');
  const [weight, setWeight] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('individual');

  const canResolve = Boolean(fromArea && toArea);

  const distanceQuery = useQuery({
    queryKey: ['distance', fromArea, toArea],
    enabled: canResolve,
    queryFn: () => resolveDistance(fromArea, toArea),
  });

  const result = useMemo(() => {
    const weightKg = Number(weight);
    if (!canResolve || !weight || !rules.data) return null;
    return calculatePrice(
      {
        weightKg,
        distanceKm: distanceQuery.data?.km ?? null,
        customerType,
        distanceSource: distanceQuery.data?.source,
      },
      rules.data,
      { areaId: toArea },
    );
  }, [canResolve, weight, rules.data, distanceQuery.data, customerType, toArea]);

  const noRules = !rules.isLoading && (rules.data ?? []).length === 0;

  return (
    <>
      <PageHeader
        title="Rate calculator"
        description="Pick the two areas, enter the weight, and see the price before you book."
      />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card className="p-5 sm:p-6">
            {areas.error ? (
              <ErrorState error={areas.error} onRetry={() => areas.refetch()} />
            ) : areas.isLoading ? (
              <div className="space-y-4">
                <SkeletonCard />
              </div>
            ) : (areas.data ?? []).length === 0 ? (
              <EmptyState
                title="No service areas configured yet"
                description="Areas are added in the admin panel. Once they exist you can calculate a price between any two of them."
              />
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Pickup area"
                    placeholder="Select an area"
                    value={fromArea}
                    onChange={(e) => setFromArea(e.target.value)}
                    required
                  >
                    {(areas.data ?? [])
                      .filter((a) => a.pickup_available)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </Select>

                  <Select
                    label="Delivery area"
                    placeholder="Select an area"
                    value={toArea}
                    onChange={(e) => setToArea(e.target.value)}
                    required
                  >
                    {(areas.data ?? [])
                      .filter((a) => a.delivery_available)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Weight"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="0.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    hint="In kilograms"
                    required
                  />
                  <Select
                    label="Sending as"
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </Select>
                </div>

                {canResolve && distanceQuery.data && (
                  <div className="flex items-center gap-2 rounded-card bg-canvas px-3.5 py-3 text-sm">
                    <Info className="h-4 w-4 shrink-0 text-ink-muted" />
                    {distanceQuery.data.km !== null ? (
                      <span className="text-ink-muted">
                        Distance between these areas:{' '}
                        <span className="font-medium text-ink">
                          {fmtDistance(distanceQuery.data.km)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-muted">
                        The distance for this pair has not been set yet.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="h-fit p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Calculator className="h-4 w-4 text-primary" />
              Price
            </h2>

            {noRules ? (
              <p className="mt-4 rounded-card bg-warning/10 p-4 text-sm leading-relaxed text-warning">
                {settings.booking.unavailableMessage}
              </p>
            ) : !result ? (
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Fill in both areas and a weight to see the price.
              </p>
            ) : !result.ok ? (
              <div className="mt-4 rounded-card bg-warning/10 p-4">
                <p className="text-sm leading-relaxed text-warning">{result.message}</p>
                {settings.contact.phone && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Call {settings.contact.phone} for a quote.
                  </p>
                )}
              </div>
            ) : (
              <>
                <dl className="mt-4 space-y-2.5 text-sm">
                  {breakdownLines(result.snapshot).map((line) => (
                    <div key={line.label} className="flex justify-between gap-4">
                      <dt className={line.muted ? 'text-ink-muted' : 'text-ink-muted'}>
                        {line.label}
                      </dt>
                      <dd className={line.amount < 0 ? 'text-success' : 'text-ink'}>
                        {line.muted ? '—' : money(line.amount)}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="text-sm font-medium text-ink">Total</span>
                  <span className="font-display text-2xl font-bold text-ink">
                    {money(result.snapshot.finalAmount)}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  Calculated from the current rate chart. The amount is locked in when you
                  place the order.
                </p>

                <Link to="/book" className="mt-5 block">
                  <Button variant="accent" size="lg" fullWidth>
                    Book this pickup
                  </Button>
                </Link>
              </>
            )}

            {rules.data && rules.data.length > 0 && (
              <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-muted">
                <Badge tone="neutral">{rules.data.length} rate rules active</Badge>
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
