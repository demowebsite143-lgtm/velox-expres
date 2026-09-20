import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, X } from 'lucide-react';
import { AdminPageHeader, DataTable, type Column } from '@/components/admin/AdminUI';
import { Button, Card, Input, Select } from '@/components/ui';
import { EmptyState, ErrorState, NotConnectedState, SkeletonTable } from '@/components/ui/states';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/OrderStatus';
import {
  listOrders, STATUS_LABELS, type OrderFilters, type OrderWithRelations,
} from '@/services/orderService';
import { list } from '@/services/crud';
import { isSupabaseConfigured } from '@/lib/supabase';
import { money, dateTime } from '@/lib/format';
import { debounce } from '@/lib/utils';
import type { Rider } from '@/types/database';

const STATUS_OPTIONS: { value: OrderFilters['status']; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((k) => ({
    value: k,
    label: STATUS_LABELS[k],
  })),
];

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All payments' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'verified', label: 'Verified' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
] as const;

export default function Orders() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderFilters['status']>('all');
  const [paymentStatus, setPaymentStatus] = useState<OrderFilters['paymentStatus']>('all');
  const [riderId, setRiderId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const debounced = useRef(debounce((value: string) => setSearch(value), 350));

  const riders = useQuery({
    queryKey: ['admin', 'riders', 'filter-list'],
    enabled: isSupabaseConfigured,
    queryFn: () => list<Rider>('riders', { orderBy: 'name' }),
  });

  const filters: OrderFilters = useMemo(
    () => ({
      status, paymentStatus, riderId: riderId as OrderFilters['riderId'],
      search, from: from || undefined, to: to || undefined,
    }),
    [status, paymentStatus, riderId, search, from, to],
  );

  const orders = useQuery({
    queryKey: ['admin', 'orders', filters],
    enabled: isSupabaseConfigured,
    queryFn: () => listOrders(filters),
  });

  const hasFilters = status !== 'all' || paymentStatus !== 'all' || riderId !== 'all' || search || from || to;
  const rows = orders.data ?? [];

  function clearFilters() {
    setStatus('all'); setPaymentStatus('all'); setRiderId('all');
    setSearch(''); setSearchInput(''); setFrom(''); setTo('');
  }

  const columns: Column<OrderWithRelations>[] = [
    {
      key: 'code', header: 'Order',
      render: (o) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink">{o.code}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{dateTime(o.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'route', header: 'Route', hideOnMobile: true,
      render: (o) => (
        <span className="text-ink-muted">
          {o.pickup_area?.name ?? '—'} → {o.delivery_area?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'customer', header: 'Customer',
      render: (o) => (
        <div>
          <p className="text-ink">{o.customer_name}</p>
          <p className="text-sm text-ink-muted">{o.rider?.name ? `Rider: ${o.rider.name}` : 'Unassigned'}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', hideOnMobile: true, render: (o) => money(Number(o.total_amount)) },
    {
      key: 'status', header: 'Status',
      render: (o) => (
        <div className="flex flex-wrap gap-1.5">
          <OrderStatusBadge status={o.status} />
          <PaymentStatusBadge status={o.payment_status} />
        </div>
      ),
    },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Orders" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Orders" description="Every order placed on the site, with dispatch and status controls." />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              placeholder="Search order, name, phone..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); debounced.current(e.target.value); }}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as OrderFilters['status'])}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as OrderFilters['paymentStatus'])}>
            {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
            <option value="all">All riders</option>
            <option value="unassigned">Unassigned</option>
            {(riders.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          {orders.data && (
            <span className="ml-auto text-sm text-ink-muted">
              {rows.length} order{rows.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </Card>

      <Card>
        {orders.isLoading ? (
          <SkeletonTable rows={8} columns={5} />
        ) : orders.error ? (
          <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={hasFilters ? 'No orders match these filters' : 'No orders yet'}
            description={
              hasFilters
                ? 'Try widening the date range or clearing a filter.'
                : 'Orders placed on the website will appear here.'
            }
            action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <DataTable columns={columns} rows={rows} onRowClick={(o) => navigate(`/admin/orders/${o.id}`)} />
        )}
      </Card>
    </div>
  );
}
