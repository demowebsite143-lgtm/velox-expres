import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ExternalLink } from 'lucide-react';
import { AdminPageHeader, DataTable, type Column } from '@/components/admin/AdminUI';
import { Button, Card, Select } from '@/components/ui';
import { EmptyState, ErrorState, NotConnectedState, SkeletonTable } from '@/components/ui/states';
import { PaymentStatusBadge } from '@/components/ui/OrderStatus';
import { requireClient, isSupabaseConfigured } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';
import { money, dateTime } from '@/lib/format';
import type { Payment, PaymentStatus } from '@/types/database';

/**
 * Every payment ever recorded, joined with its order. This is where
 * "submitted" references (a UPI transaction ID the customer typed in)
 * get checked against what actually arrived and marked verified — a
 * human decision, never automatic.
 */

interface PaymentRow extends Payment {
  order_code: string;
  customer_name: string;
}

const STATUS_FILTERS: { value: PaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Needs verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const NEXT_STATUS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['submitted', 'verified', 'failed'],
  submitted: ['verified', 'failed'],
  verified: ['refunded'],
  failed: ['pending'],
  refunded: [],
};

export default function Payments() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('submitted');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const paymentsQuery = useQuery({
    queryKey: ['admin', 'payments'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const client = requireClient();
      const { data, error } = await client
        .from('payments')
        .select('*, order:orders(code, customer_name)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        order_code: (row as { order?: { code?: string } }).order?.code ?? '—',
        customer_name: (row as { order?: { customer_name?: string } }).order?.customer_name ?? '—',
      })) as PaymentRow[];
    },
  });

  const rows = useMemo(
    () => (paymentsQuery.data ?? []).filter((p) => filter === 'all' || p.status === filter),
    [paymentsQuery.data, filter],
  );

  const needsVerification = (paymentsQuery.data ?? []).filter((p) => p.status === 'submitted').length;

  async function updateStatus(payment: PaymentRow, next: PaymentStatus) {
    setUpdatingId(payment.id);
    try {
      const client = requireClient();
      const patch: Record<string, unknown> = { status: next };
      if (next === 'verified') {
        patch.verified_at = new Date().toISOString();
        const { data: auth } = await client.auth.getUser();
        patch.verified_by = auth.user?.id ?? null;
      }
      const { error: paymentError } = await client.from('payments').update(patch).eq('id', payment.id);
      if (paymentError) throw paymentError;

      // The order's own payment_status is the one the tracking page and
      // revenue analytics read, so keep it in lockstep with the payment row.
      const { error: orderError } = await client
        .from('orders')
        .update({ payment_status: next })
        .eq('id', payment.order_id);
      if (orderError) throw orderError;

      await queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast.success(`Payment marked ${next}`);
    } catch (err) {
      toast.error('Could not update payment', err instanceof Error ? err.message : undefined);
    } finally {
      setUpdatingId(null);
    }
  }

  const columns: Column<PaymentRow>[] = [
    {
      key: 'order', header: 'Order',
      render: (p) => (
        <div>
          <p className="font-mono text-sm text-ink">{p.order_code}</p>
          <p className="text-sm text-ink-muted">{p.customer_name}</p>
        </div>
      ),
    },
    { key: 'method', header: 'Method', hideOnMobile: true, render: (p) => <span className="capitalize">{p.method.replace('_', ' ')}</span> },
    { key: 'amount', header: 'Amount', render: (p) => money(Number(p.amount)) },
    { key: 'reference', header: 'Reference', hideOnMobile: true, render: (p) => p.reference ?? '—' },
    { key: 'date', header: 'Updated', hideOnMobile: true, render: (p) => dateTime(p.updated_at) },
    { key: 'status', header: 'Status', render: (p) => <PaymentStatusBadge status={p.status} /> },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Payments" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="Verify references customers submit. Nothing here is confirmed automatically."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as PaymentStatus | 'all')} className="w-auto">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}{f.value === 'submitted' && needsVerification > 0 ? ` (${needsVerification})` : ''}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {paymentsQuery.isLoading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : paymentsQuery.error ? (
          <ErrorState error={paymentsQuery.error} onRetry={() => paymentsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title={filter === 'all' ? 'No payments recorded yet' : 'Nothing in this filter'}
            description="Payments are created automatically when an order is placed."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowActions={(p) => (
              NEXT_STATUS[p.status].length > 0 && (
                <div className="flex justify-end gap-1.5">
                  {NEXT_STATUS[p.status].map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === 'verified' ? 'primary' : 'outline'}
                      loading={updatingId === p.id}
                      onClick={() => updateStatus(p, next)}
                    >
                      {next === 'verified' ? 'Verify' : next.charAt(0).toUpperCase() + next.slice(1)}
                    </Button>
                  ))}
                  <a href={`/admin/orders/${p.order_id}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" icon={<ExternalLink className="h-3.5 w-3.5" />} />
                  </a>
                </div>
              )
            )}
          />
        )}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Marking a payment verified also updates the order's payment status, which is what customer
        tracking and revenue analytics read.
      </p>
    </div>
  );
}
