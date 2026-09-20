import { useState } from 'react';
import { Bike, Phone, Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, DataTable, type Column } from '@/components/admin/AdminUI';
import { Badge, Button, Card, Checkbox, Input, Select } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { EmptyState, ErrorState, SkeletonTable, NotConnectedState } from '@/components/ui/states';
import { useAdminList } from '@/hooks/useAdminList';
import { useServiceAreas } from '@/hooks/useCatalog';
import { isSupabaseConfigured } from '@/lib/supabase';
import { telLink } from '@/lib/utils';
import type { Rider, RiderAvailability } from '@/types/database';

const AVAILABILITY_LABELS: Record<RiderAvailability, string> = {
  available: 'Available',
  busy: 'Busy',
  off_duty: 'Off duty',
};

const AVAILABILITY_TONE: Record<RiderAvailability, 'success' | 'warning' | 'neutral'> = {
  available: 'success',
  busy: 'warning',
  off_duty: 'neutral',
};

interface RiderForm {
  name: string;
  phone: string;
  whatsapp: string;
  service_area_id: string;
  shift: string;
  availability: RiderAvailability;
  notes: string;
  is_active: boolean;
}

const EMPTY_FORM: RiderForm = {
  name: '', phone: '', whatsapp: '', service_area_id: '', shift: '',
  availability: 'available', notes: '', is_active: true,
};

export default function Riders() {
  const riders = useAdminList<Rider>('riders', { orderBy: 'name' });
  const areas = useServiceAreas();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rider | null>(null);
  const [form, setForm] = useState<RiderForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Rider | null>(null);

  const areaName = (id: string | null) => areas.data?.find((a) => a.id === id)?.name ?? null;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(rider: Rider) {
    setEditing(rider);
    setForm({
      name: rider.name,
      phone: rider.phone,
      whatsapp: rider.whatsapp ?? '',
      service_area_id: rider.service_area_id ?? '',
      shift: rider.shift ?? '',
      availability: rider.availability,
      notes: rider.notes ?? '',
      is_active: rider.is_active,
    });
    setModalOpen(true);
  }

  async function onSave() {
    const values = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || null,
      service_area_id: form.service_area_id || null,
      shift: form.shift.trim() || null,
      availability: form.availability,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    if (editing) await riders.update(editing.id, values);
    else await riders.create(values);
    setModalOpen(false);
  }

  const columns: Column<Rider>[] = [
    {
      key: 'name',
      header: 'Rider',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.name}</p>
          <p className="text-sm text-ink-muted sm:hidden">{r.phone}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideOnMobile: true, render: (r) => r.phone },
    { key: 'area', header: 'Area', hideOnMobile: true, render: (r) => areaName(r.service_area_id) ?? '—' },
    {
      key: 'availability',
      header: 'Status',
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={AVAILABILITY_TONE[r.availability]}>{AVAILABILITY_LABELS[r.availability]}</Badge>
          {!r.is_active && <Badge tone="danger">Disabled</Badge>}
        </div>
      ),
    },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Delivery boys" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Delivery boys"
        description="Riders who deliver orders. They never get admin access — they work from a per-order link."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add rider</Button>}
      />

      <Card>
        {riders.isLoading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : riders.error ? (
          <ErrorState error={riders.error} onRetry={() => riders.refetch()} />
        ) : riders.rows.length === 0 ? (
          <EmptyState
            icon={<Bike className="h-6 w-6" />}
            title="No riders added yet"
            description="Add your first rider to start assigning orders to them."
            action={<Button onClick={openCreate}>Add rider</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={riders.rows}
            onRowClick={openEdit}
            rowActions={(r) => (
              <div className="flex items-center gap-1">
                <a href={telLink(r.phone)} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>
                    <span className="hidden lg:inline">Call</span>
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setDeleteTarget(r)}
                >
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
        title={editing ? 'Edit rider' : 'Add rider'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={onSave}
              loading={riders.creating || riders.updating}
              disabled={!form.name.trim() || !form.phone.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={form.name} required
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Phone" inputMode="tel" value={form.phone} required
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <Input label="WhatsApp number" hint="Leave blank to use the phone number above"
            inputMode="tel" value={form.whatsapp}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value.replace(/\D/g, '') }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Service area" placeholder="No fixed area" value={form.service_area_id}
              onChange={(e) => setForm((f) => ({ ...f, service_area_id: e.target.value }))}>
              {(areas.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <Select label="Availability" value={form.availability}
              onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value as RiderAvailability }))}>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="off_duty">Off duty</option>
            </Select>
          </div>
          <Input label="Shift" hint="Optional — e.g. Morning, 9am–2pm"
            value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))} />
          <Input label="Notes" hint="Optional"
            value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <Checkbox label="Active" description="Inactive riders cannot be assigned new orders."
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await riders.remove(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete this rider?"
        message={`${deleteTarget?.name ?? 'This rider'} will be removed. Orders already assigned to them keep their history.`}
        confirmLabel="Delete"
        tone="danger"
        loading={riders.removing}
      />
    </div>
  );
}
