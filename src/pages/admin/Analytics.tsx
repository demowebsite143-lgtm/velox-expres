import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileDown, TrendingUp } from 'lucide-react';
import { AdminPageHeader, DataTable, StatCard, type Column } from '@/components/admin/AdminUI';
import { Button, Card, CardHeader, Select, Input } from '@/components/ui';
import { EmptyState, ErrorState, NotConnectedState, SkeletonCard } from '@/components/ui/states';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart';
import CategoryBarChart from '@/components/charts/CategoryBarChart';
import PaymentBreakdownChart from '@/components/charts/PaymentBreakdownChart';
import {
  getDailySeries, getExpensesByCategory, getOrdersByStatus, getPaymentBreakdown,
  getRevenueByArea, getRevenueByParcelType, getRiderPerformance, getSummary,
  isEmptySummary, rangeFor, RANGE_LABELS, type RangePreset, type RiderPerformanceRow,
} from '@/services/analyticsService';
import { listOrders } from '@/services/orderService';
import { list } from '@/services/crud';
import { downloadExpensesCsv, downloadOrdersCsv, downloadSummaryPdf } from '@/services/reportService';
import { useSettings } from '@/providers/SettingsProvider';
import { useToast } from '@/providers/ToastProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { money, count as fmtCount, shortDate } from '@/lib/format';
import type { Expense } from '@/types/database';

const PRESETS: RangePreset[] = ['7d', '30d', '90d', '6m', '1y', 'custom'];

export default function Analytics() {
  const { brandName } = useSettings();
  const toast = useToast();
  const [preset, setPreset] = useState<RangePreset>('30d');
  const defaultRange = useMemo(() => rangeFor('30d'), []);
  const [customFrom, setCustomFrom] = useState(defaultRange.from);
  const [customTo, setCustomTo] = useState(defaultRange.to);
  const [exporting, setExporting] = useState<'orders' | 'expenses' | 'pdf' | null>(null);

  const range = useMemo(
    () => rangeFor(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );

  const summary = useQuery({
    queryKey: ['admin', 'analytics', 'summary', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getSummary(range),
  });
  const daily = useQuery({
    queryKey: ['admin', 'analytics', 'daily', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getDailySeries(range),
  });
  const byStatus = useQuery({
    queryKey: ['admin', 'analytics', 'status', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getOrdersByStatus(range),
  });
  const byPayment = useQuery({
    queryKey: ['admin', 'analytics', 'payment', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getPaymentBreakdown(range),
  });
  const byArea = useQuery({
    queryKey: ['admin', 'analytics', 'area', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getRevenueByArea(range),
  });
  const byParcel = useQuery({
    queryKey: ['admin', 'analytics', 'parcel', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getRevenueByParcelType(range),
  });
  const byExpenseCategory = useQuery({
    queryKey: ['admin', 'analytics', 'expense-category', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getExpensesByCategory(range),
  });
  const riderPerf = useQuery({
    queryKey: ['admin', 'analytics', 'riders', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getRiderPerformance(range),
  });

  const ordersCountByStatus = (byStatus.data ?? []).map((s) => ({ label: s.label, value: s.count, count: s.count }));

  async function exportOrders() {
    setExporting('orders');
    try {
      const orders = await listOrders({ from: range.from, to: range.to, limit: 5000 });
      if (orders.length === 0) { toast.error('No orders in this range'); return; }
      downloadOrdersCsv(orders, `orders-${range.from}-to-${range.to}.csv`);
    } catch (err) {
      toast.error('Could not export orders', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(null);
    }
  }

  async function exportExpenses() {
    setExporting('expenses');
    try {
      const all = await list<Expense>('expenses', { orderBy: 'spent_on' });
      const inRange = all.filter((e) => e.spent_on >= range.from && e.spent_on <= range.to);
      if (inRange.length === 0) { toast.error('No expenses in this range'); return; }
      downloadExpensesCsv(inRange, `expenses-${range.from}-to-${range.to}.csv`);
    } catch (err) {
      toast.error('Could not export expenses', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    if (!summary.data) return;
    setExporting('pdf');
    try {
      downloadSummaryPdf({
        brandName,
        rangeLabel: RANGE_LABELS[preset],
        from: range.from,
        to: range.to,
        summary: summary.data,
        daily: daily.data ?? [],
        ordersByStatus: byStatus.data ?? [],
        paymentBreakdown: byPayment.data ?? [],
        revenueByArea: byArea.data ?? [],
        revenueByParcelType: byParcel.data ?? [],
      });
    } catch (err) {
      toast.error('Could not build the PDF', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(null);
    }
  }

  const riderColumns: Column<RiderPerformanceRow & { id: string }>[] = [
    { key: 'name', header: 'Rider', render: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: 'delivered', header: 'Delivered', render: (r) => fmtCount(r.delivered) },
    { key: 'inProgress', header: 'In progress', hideOnMobile: true, render: (r) => fmtCount(r.inProgress) },
    { key: 'cancelled', header: 'Cancelled', hideOnMobile: true, render: (r) => fmtCount(r.cancelled) },
    { key: 'total', header: 'Total assigned', render: (r) => fmtCount(r.total) },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Reports" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  const empty = isEmptySummary(summary.data);

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        description="Revenue counts an order only once it's delivered and payment-verified, using the price frozen at booking."
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Period" value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} className="w-40">
            {PRESETS.map((p) => <option key={p} value={p}>{RANGE_LABELS[p]}</option>)}
          </Select>
          {preset === 'custom' && (
            <>
              <Input type="date" label="From" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" />
              <Input type="date" label="To" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" />
            </>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}
              loading={exporting === 'orders'} onClick={exportOrders}>
              Orders CSV
            </Button>
            <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}
              loading={exporting === 'expenses'} onClick={exportExpenses}>
              Expenses CSV
            </Button>
            <Button variant="outline" size="sm" icon={<FileDown className="h-3.5 w-3.5" />}
              loading={exporting === 'pdf'} disabled={!summary.data} onClick={exportPdf}>
              PDF report
            </Button>
          </div>
        </div>
      </Card>

      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : summary.error ? (
        <Card><ErrorState error={summary.error} onRetry={() => summary.refetch()} /></Card>
      ) : empty ? (
        <Card>
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="Nothing recorded in this period"
            description="Once orders are delivered and paid, or expenses are logged, this report fills in with real figures."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Revenue" value={money(Number(summary.data!.revenue))} hint={`${fmtCount(summary.data!.revenue_order_count)} orders`} />
            <StatCard label="Expenses" value={money(Number(summary.data!.expenses))} />
            <StatCard label="Net profit" value={money(Number(summary.data!.net_profit))} />
            <StatCard label="Avg order value" value={money(Number(summary.data!.avg_order_value))} />
            <StatCard label="Awaiting payment" value={money(Number(summary.data!.pending_payment_amount))} hint="Not counted as revenue" />
          </div>

          <Card>
            <CardHeader title="Revenue, expenses & profit" description={`${shortDate(range.from)} – ${shortDate(range.to)}`} />
            <div className="p-4 sm:p-5">
              {daily.isLoading ? <SkeletonCard className="border-0 shadow-none" /> : <RevenueTrendChart data={daily.data ?? []} />}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Orders by status" />
              <div className="p-4 sm:p-5">
                {byStatus.isLoading ? <SkeletonCard className="border-0 shadow-none" /> : ordersCountByStatus.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">No orders in this period.</p>
                ) : (
                  <CategoryBarChart data={ordersCountByStatus} valueLabel="Orders" formatValue={fmtCount} />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Payments by status" />
              <div className="p-4 sm:p-5">
                {byPayment.isLoading ? <SkeletonCard className="border-0 shadow-none" /> : (byPayment.data ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">No payments in this period.</p>
                ) : (
                  <PaymentBreakdownChart data={byPayment.data ?? []} />
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue by area" description="Delivered & payment-verified orders only" />
              <div className="p-4 sm:p-5">
                {byArea.isLoading ? <SkeletonCard className="border-0 shadow-none" /> : (byArea.data ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">No recognised revenue yet in this period.</p>
                ) : (
                  <CategoryBarChart data={byArea.data ?? []} valueLabel="Revenue" />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Revenue by parcel type" />
              <div className="p-4 sm:p-5">
                {byParcel.isLoading ? <SkeletonCard className="border-0 shadow-none" /> : (byParcel.data ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">No recognised revenue yet in this period.</p>
                ) : (
                  <CategoryBarChart data={byParcel.data ?? []} valueLabel="Revenue" />
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Expenses by category" />
            <div className="p-4 sm:p-5">
              {byExpenseCategory.isLoading ? <SkeletonCard className="border-0 shadow-none" /> : (byExpenseCategory.data ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No expenses logged in this period.</p>
              ) : (
                <CategoryBarChart data={byExpenseCategory.data ?? []} valueLabel="Expenses" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Rider performance" description="Orders assigned in this period, by outcome" />
            {riderPerf.isLoading ? (
              <div className="p-5"><SkeletonCard className="border-0 shadow-none" /></div>
            ) : (riderPerf.data ?? []).length === 0 ? (
              <EmptyState title="No riders active yet" />
            ) : (
              <DataTable
                columns={riderColumns}
                rows={(riderPerf.data ?? []).map((r) => ({ ...r, id: r.riderId }))}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
