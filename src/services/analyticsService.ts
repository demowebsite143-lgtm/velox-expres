import { requireClient } from '@/lib/supabase';
import { isoDate } from '@/lib/format';
import { subDays, subMonths, startOfDay } from 'date-fns';
import type {
  AnalyticsDailyRow,
  AnalyticsSummary,
  ExpenseCategory,
  OrderStatus,
  PaymentStatus,
} from '@/types/database';

/**
 * Every figure here is read from recorded rows. Nothing is estimated,
 * projected or filled in. When a period has no rows the caller gets
 * zeros with a count of zero, and the UI shows an empty state rather
 * than a zero that looks like a measurement.
 *
 * Revenue definition (see the revenue_orders view): an order counts
 * only when it is delivered AND its payment is verified, and the amount
 * comes from the frozen price snapshot, never from current rate rules.
 */

export type RangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'custom';

export interface DateRange {
  from: string;
  to: string;
  preset: RangePreset;
}

export function rangeFor(preset: RangePreset, custom?: { from: string; to: string }): DateRange {
  const today = startOfDay(new Date());
  const to = isoDate(today);

  switch (preset) {
    case '7d':
      return { from: isoDate(subDays(today, 6)), to, preset };
    case '30d':
      return { from: isoDate(subDays(today, 29)), to, preset };
    case '90d':
      return { from: isoDate(subDays(today, 89)), to, preset };
    case '6m':
      return { from: isoDate(subMonths(today, 6)), to, preset };
    case '1y':
      return { from: isoDate(subMonths(today, 12)), to, preset };
    case 'custom':
      return {
        from: custom?.from ?? isoDate(subDays(today, 29)),
        to: custom?.to ?? to,
        preset,
      };
  }
}

export const RANGE_LABELS: Record<RangePreset, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '6m': '6 months',
  '1y': '1 year',
  custom: 'Custom',
};

export async function getSummary(range: DateRange): Promise<AnalyticsSummary> {
  const client = requireClient();
  const { data, error } = await client.rpc('analytics_summary', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return data as AnalyticsSummary;
}

export async function getDailySeries(range: DateRange): Promise<AnalyticsDailyRow[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('analytics_daily', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return ((data ?? []) as AnalyticsDailyRow[]).map((r) => ({
    day: r.day,
    revenue: Number(r.revenue),
    expenses: Number(r.expenses),
    orders: Number(r.orders),
  }));
}

export interface Slice {
  label: string;
  value: number;
  count: number;
}

export async function getOrdersByStatus(range: DateRange): Promise<Slice[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('orders')
    .select('status, total_amount')
    .gte('created_at', `${range.from}T00:00:00`)
    .lte('created_at', `${range.to}T23:59:59`);
  if (error) throw error;

  return aggregate(
    (data ?? []) as { status: OrderStatus; total_amount: number }[],
    (r) => r.status,
    (r) => Number(r.total_amount),
  );
}

export async function getPaymentBreakdown(range: DateRange): Promise<Slice[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('orders')
    .select('payment_status, total_amount')
    .neq('status', 'cancelled')
    .gte('created_at', `${range.from}T00:00:00`)
    .lte('created_at', `${range.to}T23:59:59`);
  if (error) throw error;

  return aggregate(
    (data ?? []) as { payment_status: PaymentStatus; total_amount: number }[],
    (r) => r.payment_status,
    (r) => Number(r.total_amount),
  );
}

export async function getExpensesByCategory(range: DateRange): Promise<Slice[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('expenses')
    .select('category, amount')
    .gte('spent_on', range.from)
    .lte('spent_on', range.to);
  if (error) throw error;

  return aggregate(
    (data ?? []) as { category: ExpenseCategory; amount: number }[],
    (r) => r.category.replace(/_/g, ' '),
    (r) => Number(r.amount),
  );
}

export async function getRevenueByArea(range: DateRange): Promise<Slice[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('revenue_orders')
    .select('total_amount, delivery_area_id')
    .gte('recognised_on', range.from)
    .lte('recognised_on', range.to);
  if (error) throw error;

  const rows = (data ?? []) as { total_amount: number; delivery_area_id: string | null }[];
  if (rows.length === 0) return [];

  const { data: areas } = await client.from('service_areas').select('id, name');
  const names = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));

  return aggregate(
    rows,
    (r) => (r.delivery_area_id ? names.get(r.delivery_area_id) ?? 'Unknown area' : 'Unknown area'),
    (r) => Number(r.total_amount),
  );
}

export async function getRevenueByParcelType(range: DateRange): Promise<Slice[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('revenue_orders')
    .select('total_amount, parcel_type')
    .gte('recognised_on', range.from)
    .lte('recognised_on', range.to);
  if (error) throw error;

  return aggregate(
    (data ?? []) as { total_amount: number; parcel_type: string }[],
    (r) => r.parcel_type,
    (r) => Number(r.total_amount),
  );
}

export interface RiderPerformanceRow {
  riderId: string;
  name: string;
  delivered: number;
  cancelled: number;
  inProgress: number;
  total: number;
}

export async function getRiderPerformance(range: DateRange): Promise<RiderPerformanceRow[]> {
  const client = requireClient();

  const { data: riders, error: riderError } = await client
    .from('riders')
    .select('id, name')
    .eq('is_active', true);
  if (riderError) throw riderError;

  const { data: orders, error: orderError } = await client
    .from('orders')
    .select('rider_id, status')
    .not('rider_id', 'is', null)
    .gte('created_at', `${range.from}T00:00:00`)
    .lte('created_at', `${range.to}T23:59:59`);
  if (orderError) throw orderError;

  const rows = (orders ?? []) as { rider_id: string; status: OrderStatus }[];

  return ((riders ?? []) as { id: string; name: string }[])
    .map((rider) => {
      const own = rows.filter((o) => o.rider_id === rider.id);
      return {
        riderId: rider.id,
        name: rider.name,
        delivered: own.filter((o) => o.status === 'delivered').length,
        cancelled: own.filter((o) => o.status === 'cancelled').length,
        inProgress: own.filter(
          (o) => o.status !== 'delivered' && o.status !== 'cancelled',
        ).length,
        total: own.length,
      };
    })
    .sort((a, b) => b.delivered - a.delivered);
}

function aggregate<T>(
  rows: T[],
  keyOf: (row: T) => string,
  valueOf: (row: T) => number,
): Slice[] {
  const map = new Map<string, Slice>();
  for (const row of rows) {
    const key = keyOf(row);
    const existing = map.get(key) ?? { label: key, value: 0, count: 0 };
    existing.value += valueOf(row);
    existing.count += 1;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/** True when there is genuinely nothing recorded for this period. */
export function isEmptySummary(summary: AnalyticsSummary | undefined): boolean {
  if (!summary) return true;
  return (
    summary.total_orders === 0 &&
    Number(summary.revenue) === 0 &&
    Number(summary.expenses) === 0
  );
}
