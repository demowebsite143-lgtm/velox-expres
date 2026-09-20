import { useMemo, useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { AdminPageHeader, DataTable, StatCard, type Column } from '@/components/admin/AdminUI';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { EmptyState, ErrorState, NotConnectedState, SkeletonTable } from '@/components/ui/states';
import { useAdminList } from '@/hooks/useAdminList';
import { list } from '@/services/crud';
import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { money, shortDate, isoDate } from '@/lib/format';
import type { Expense, ExpenseCategory, Rider } from '@/types/database';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'rider_salary', label: 'Rider salary' },
  { value: 'vehicle_maintenance', label: 'Vehicle maintenance' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'office', label: 'Office' },
  { value: 'software', label: 'Software' },
  { value: 'other', label: 'Other' },
];

interface ExpenseForm {
  title: string; category: ExpenseCategory; amount: string; spent_on: string;
  description: string; payment_method: string; rider_id: string;
}
const EMPTY_EXPENSE: ExpenseForm = {
  title: '', category: 'other', amount: '', spent_on: isoDate(new Date()),
  description: '', payment_method: '', rider_id: '',
};

export default function Expenses() {
  const expenses = useAdminList<Expense>('expenses', { orderBy: 'spent_on', ascending: false });
  const riders = useQuery({
    queryKey: ['admin', 'riders', 'expense-filter'],
    enabled: isSupabaseConfigured,
    queryFn: () => list<Rider>('riders', { orderBy: 'name' }),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(EMPTY_EXPENSE);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const riderName = (id: string | null) => riders.data?.find((r) => r.id === id)?.name ?? null;

  const totals = useMemo(() => {
    const rows = expenses.rows;
    const thisMonth = rows.filter((e) => e.spent_on.slice(0, 7) === isoDate(new Date()).slice(0, 7));
    return {
      total: rows.reduce((sum, e) => sum + Number(e.amount), 0),
      thisMonth: thisMonth.reduce((sum, e) => sum + Number(e.amount), 0),
      count: rows.length,
    };
  }, [expenses.rows]);

  function openCreate() { setEditing(null); setForm(EMPTY_EXPENSE); setModalOpen(true); }
  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      title: expense.title, category: expense.category, amount: String(expense.amount),
      spent_on: expense.spent_on, description: expense.description ?? '',
      payment_method: expense.payment_method ?? '', rider_id: expense.rider_id ?? '',
    });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      title: form.title.trim(), category: form.category, amount: Number(form.amount),
      spent_on: form.spent_on, description: form.description.trim() || null,
      payment_method: form.payment_method.trim() || null, rider_id: form.rider_id || null,
    };
    if (editing) await expenses.update(editing.id, values);
    else await expenses.create(values);
    setModalOpen(false);
  }

  const columns: Column<Expense>[] = [
    {
      key: 'title', header: 'Expense',
      render: (e) => (
        <div>
          <p className="font-medium text-ink">{e.title}</p>
          <p className="text-sm capitalize text-ink-muted">{e.category.replace(/_/g, ' ')}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', hideOnMobile: true, render: (e) => shortDate(e.spent_on) },
    { key: 'rider', header: 'Rider', hideOnMobile: true, render: (e) => riderName(e.rider_id) ?? '—' },
    { key: 'amount', header: 'Amount', render: (e) => <span className="font-medium">{money(Number(e.amount))}</span> },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Expenses" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Expenses"
        description="Every cost you enter here is subtracted from revenue in the profit report."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add expense</Button>}
      />

      {expenses.rows.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="This month" value={money(totals.thisMonth)} />
          <StatCard label="All time" value={money(totals.total)} hint={`${totals.count} entries`} />
        </div>
      )}

      <Card>
        {expenses.isLoading ? (
          <SkeletonTable rows={6} columns={4} />
        ) : expenses.error ? (
          <ErrorState error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : expenses.rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No expenses recorded yet"
            description="Fuel, rider pay, packaging and other costs go here. Profit reports have nothing to subtract until you add some."
            action={<Button onClick={openCreate}>Add expense</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={expenses.rows}
            onRowClick={openEdit}
            rowActions={(e) => (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(e)} />
            )}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit expense' : 'Add expense'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={expenses.creating || expenses.updating}
              disabled={!form.title.trim() || !form.amount || !form.spent_on}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input label="Title" value={form.title} required onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Amount" prefix="₹" type="number" min="0" step="1" value={form.amount} required
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" value={form.spent_on} required
              onChange={(e) => setForm((f) => ({ ...f, spent_on: e.target.value }))} />
            <Select label="Related rider" placeholder="None" value={form.rider_id}
              onChange={(e) => setForm((f) => ({ ...f, rider_id: e.target.value }))}>
              {(riders.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </div>
          <Input label="Payment method" hint="Optional — e.g. Cash, UPI" value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))} />
          <Textarea label="Notes" hint="Optional" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await expenses.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this expense?"
        message="This will reduce recorded costs, which increases past profit figures."
        confirmLabel="Delete"
        tone="danger"
        loading={expenses.removing}
      />
    </div>
  );
}
