import { useState } from 'react';
import { Briefcase, Phone, Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, DataTable, type Column } from '@/components/admin/AdminUI';
import { Badge, Button, Card, Checkbox, Input, Select, Textarea } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { EmptyState, ErrorState, NotConnectedState, SkeletonTable } from '@/components/ui/states';
import { useAdminList } from '@/hooks/useAdminList';
import { useServiceAreas } from '@/hooks/useCatalog';
import { isSupabaseConfigured } from '@/lib/supabase';
import { telLink } from '@/lib/utils';
import { money } from '@/lib/format';
import type { BusinessCustomer } from '@/types/database';

/**
 * Business accounts — regular senders with agreed terms. This is
 * reference and billing-status data the admin keeps by hand; it does
 * not change how the booking form prices an order (that always runs
 * through the shared rate chart), so there is no rate override wired
 * in here. "Special pricing notes" is a place to record what was
 * agreed verbally or by contract, not a machine-applied discount.
 */

const CREDIT_STATUSES = [
  { value: 'none', label: 'No credit terms' },
  { value: 'good', label: 'Good standing' },
  { value: 'watch', label: 'Watch' },
  { value: 'hold', label: 'On hold' },
] as const;

interface BusinessForm {
  business_name: string; contact_person: string; phone: string; email: string;
  address: string; service_area_id: string; monthly_billing: boolean;
  credit_limit: string; credit_status: string; special_pricing_notes: string;
  notes: string; is_active: boolean;
}
const EMPTY_FORM: BusinessForm = {
  business_name: '', contact_person: '', phone: '', email: '', address: '',
  service_area_id: '', monthly_billing: false, credit_limit: '', credit_status: 'none',
  special_pricing_notes: '', notes: '', is_active: true,
};

function readNotes(value: Record<string, unknown>): string {
  const notes = value?.notes;
  return typeof notes === 'string' ? notes : '';
}

export default function BusinessCustomers() {
  const customers = useAdminList<BusinessCustomer>('business_customers', { orderBy: 'business_name' });
  const areas = useServiceAreas();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessCustomer | null>(null);
  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<BusinessCustomer | null>(null);

  const areaName = (id: string | null) => areas.data?.find((a) => a.id === id)?.name ?? null;

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); }
  function openEdit(customer: BusinessCustomer) {
    setEditing(customer);
    setForm({
      business_name: customer.business_name, contact_person: customer.contact_person ?? '',
      phone: customer.phone, email: customer.email ?? '', address: customer.address ?? '',
      service_area_id: customer.service_area_id ?? '', monthly_billing: customer.monthly_billing,
      credit_limit: customer.credit_limit !== null ? String(customer.credit_limit) : '',
      credit_status: customer.credit_status, special_pricing_notes: readNotes(customer.special_pricing),
      notes: customer.notes ?? '', is_active: customer.is_active,
    });
    setModalOpen(true);
  }

  async function onSave() {
    const values = {
      business_name: form.business_name.trim(), contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim(), email: form.email.trim() || null, address: form.address.trim() || null,
      service_area_id: form.service_area_id || null, monthly_billing: form.monthly_billing,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
      credit_status: form.credit_status,
      special_pricing: form.special_pricing_notes.trim() ? { notes: form.special_pricing_notes.trim() } : {},
      notes: form.notes.trim() || null, is_active: form.is_active,
    };
    if (editing) await customers.update(editing.id, values);
    else await customers.create(values);
    setModalOpen(false);
  }

  const columns: Column<BusinessCustomer>[] = [
    {
      key: 'name', header: 'Business',
      render: (c) => (
        <div>
          <p className="font-medium text-ink">{c.business_name}</p>
          <p className="text-sm text-ink-muted">{c.contact_person || c.phone}</p>
        </div>
      ),
    },
    { key: 'area', header: 'Area', hideOnMobile: true, render: (c) => areaName(c.service_area_id) ?? '—' },
    { key: 'credit', header: 'Credit limit', hideOnMobile: true, render: (c) => c.credit_limit !== null ? money(c.credit_limit) : '—' },
    {
      key: 'status', header: 'Status',
      render: (c) => (
        <div className="flex flex-wrap gap-1.5">
          {c.monthly_billing && <Badge tone="info">Monthly billing</Badge>}
          <Badge tone={c.credit_status === 'hold' ? 'danger' : c.credit_status === 'watch' ? 'warning' : 'neutral'}>
            {CREDIT_STATUSES.find((s) => s.value === c.credit_status)?.label ?? c.credit_status}
          </Badge>
          {!c.is_active && <Badge tone="danger">Disabled</Badge>}
        </div>
      ),
    },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Business accounts" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Business accounts"
        description="Regular senders with agreed terms — billing status and contact details, kept by hand."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add business</Button>}
      />

      <Card>
        {customers.isLoading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : customers.error ? (
          <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
        ) : customers.rows.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="No business accounts yet"
            description="Add a business here to keep track of contact details, agreed terms and billing status. This doesn't change pricing on the booking form — that always uses the shared rate chart."
            action={<Button onClick={openCreate}>Add business</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={customers.rows}
            onRowClick={openEdit}
            rowActions={(c) => (
              <div className="flex items-center gap-1">
                <a href={telLink(c.phone)} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>
                    <span className="hidden lg:inline">Call</span>
                  </Button>
                </a>
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(c)}>
                  <span className="hidden lg:inline">Delete</span>
                </Button>
              </div>
            )}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title={editing ? 'Edit business account' : 'Add business account'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={customers.creating || customers.updating}
              disabled={!form.business_name.trim() || !form.phone.trim()}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Business name" value={form.business_name} required
              onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} />
            <Input label="Contact person" value={form.contact_person}
              onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" inputMode="tel" value={form.phone} required
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} />
            <Input label="Email" type="email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <Textarea label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Select label="Usual service area" placeholder="None set" value={form.service_area_id}
            onChange={(e) => setForm((f) => ({ ...f, service_area_id: e.target.value }))}>
            {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Credit status" value={form.credit_status}
              onChange={(e) => setForm((f) => ({ ...f, credit_status: e.target.value }))}>
              {CREDIT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Input label="Credit limit" prefix="₹" hint="Optional" type="number" min="0" value={form.credit_limit}
              onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))} />
          </div>
          <Checkbox label="Monthly billing" description="Settled at month end rather than per order."
            checked={form.monthly_billing} onChange={(e) => setForm((f) => ({ ...f, monthly_billing: e.target.checked }))} />
          <Textarea label="Special pricing notes" hint="What was agreed, for your own reference — does not change the booking calculator"
            value={form.special_pricing_notes} onChange={(e) => setForm((f) => ({ ...f, special_pricing_notes: e.target.value }))} />
          <Textarea label="Notes" hint="Optional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <Checkbox label="Active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await customers.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this business account?"
        message={`${deleteTarget?.business_name ?? 'This account'} will be removed. Past orders keep their own records.`}
        confirmLabel="Delete"
        tone="danger"
        loading={customers.removing}
      />
    </div>
  );
}
