import { useState } from 'react';
import { MapPin, Plus, Ruler, Tags, Trash2 } from 'lucide-react';
import { AdminPageHeader, DataTable, Tabs, type Column } from '@/components/admin/AdminUI';
import { Badge, Button, Card, Checkbox, Input, Select } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { EmptyState, ErrorState, NotConnectedState, SkeletonTable } from '@/components/ui/states';
import { useAdminList } from '@/hooks/useAdminList';
import { useServiceAreas } from '@/hooks/useCatalog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildMatrix, deleteDistance, listDistanceRows, matrixCoverage, upsertDistance,
} from '@/services/distanceService';
import { useToast } from '@/providers/ToastProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CustomerType, PricingRule, ServiceArea } from '@/types/database';

/* ==================================================================== */
/* Service areas                                                        */
/* ==================================================================== */

interface AreaForm {
  name: string; city: string; pin_code: string; radius_km: string;
  pickup_available: boolean; delivery_available: boolean; is_active: boolean;
}
const EMPTY_AREA: AreaForm = {
  name: '', city: '', pin_code: '', radius_km: '',
  pickup_available: true, delivery_available: true, is_active: true,
};

function ServiceAreasTab() {
  const areas = useAdminList<ServiceArea>('service_areas', { orderBy: 'display_order' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  const [form, setForm] = useState<AreaForm>(EMPTY_AREA);
  const [deleteTarget, setDeleteTarget] = useState<ServiceArea | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_AREA);
    setModalOpen(true);
  }
  function openEdit(area: ServiceArea) {
    setEditing(area);
    setForm({
      name: area.name, city: area.city ?? '', pin_code: area.pin_code ?? '',
      radius_km: area.radius_km?.toString() ?? '',
      pickup_available: area.pickup_available, delivery_available: area.delivery_available,
      is_active: area.is_active,
    });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      name: form.name.trim(), city: form.city.trim() || null, pin_code: form.pin_code.trim() || null,
      radius_km: form.radius_km ? Number(form.radius_km) : null,
      pickup_available: form.pickup_available, delivery_available: form.delivery_available,
      is_active: form.is_active,
      display_order: editing?.display_order ?? areas.rows.length + 1,
    };
    if (editing) await areas.update(editing.id, values);
    else await areas.create(values);
    setModalOpen(false);
  }

  const columns: Column<ServiceArea>[] = [
    { key: 'name', header: 'Area', render: (a) => <span className="font-medium text-ink">{a.name}</span> },
    { key: 'city', header: 'City', hideOnMobile: true, render: (a) => a.city ?? '—' },
    {
      key: 'flags', header: 'Available for',
      render: (a) => (
        <div className="flex flex-wrap gap-1.5">
          {a.pickup_available && <Badge tone="info">Pickup</Badge>}
          {a.delivery_available && <Badge tone="primary">Delivery</Badge>}
          {!a.is_active && <Badge tone="danger">Disabled</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add area</Button>
      </div>
      <Card>
        {areas.isLoading ? (
          <SkeletonTable rows={4} columns={3} />
        ) : areas.error ? (
          <ErrorState error={areas.error} onRetry={() => areas.refetch()} />
        ) : areas.rows.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-6 w-6" />}
            title="No service areas yet"
            description="Add the areas you operate in. Booking, the calculator and the distance matrix all depend on this list."
            action={<Button onClick={openCreate}>Add area</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={areas.rows}
            onRowClick={openEdit}
            rowActions={(a) => (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDeleteTarget(a)}>
                <span className="hidden lg:inline">Delete</span>
              </Button>
            )}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit area' : 'Add area'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={areas.creating || areas.updating} disabled={!form.name.trim()}>
              Save
            </Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Area name" value={form.name} required
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <Input label="PIN code" value={form.pin_code} onChange={(e) => setForm((f) => ({ ...f, pin_code: e.target.value }))} />
          </div>
          <Input label="Radius (km)" hint="Optional — for your own reference" type="number" min="0"
            value={form.radius_km} onChange={(e) => setForm((f) => ({ ...f, radius_km: e.target.value }))} />
          <Checkbox label="Pickups available here" checked={form.pickup_available}
            onChange={(e) => setForm((f) => ({ ...f, pickup_available: e.target.checked }))} />
          <Checkbox label="Deliveries available here" checked={form.delivery_available}
            onChange={(e) => setForm((f) => ({ ...f, delivery_available: e.target.checked }))} />
          <Checkbox label="Active" description="Inactive areas are hidden from the booking form."
            checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await areas.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this area?"
        message={`${deleteTarget?.name ?? 'This area'} will be removed. Distances involving it will also be removed.`}
        confirmLabel="Delete" tone="danger" loading={areas.removing} />
    </div>
  );
}

/* ==================================================================== */
/* Pricing rules                                                        */
/* ==================================================================== */

interface RuleForm {
  name: string; weight_from_kg: string; weight_to_kg: string;
  distance_from_km: string; distance_to_km: string;
  base_price: string; per_km_price: string;
  additional_weight_charge: string; additional_weight_step_kg: string;
  max_charge: string; customer_type: CustomerType; priority: string; is_active: boolean;
}
const EMPTY_RULE: RuleForm = {
  name: '', weight_from_kg: '0', weight_to_kg: '', distance_from_km: '0', distance_to_km: '',
  base_price: '', per_km_price: '0', additional_weight_charge: '0', additional_weight_step_kg: '1',
  max_charge: '', customer_type: 'individual', priority: '0', is_active: true,
};

function PricingRulesTab() {
  const rules = useAdminList<PricingRule>('pricing_rules', { orderBy: 'priority', ascending: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [deleteTarget, setDeleteTarget] = useState<PricingRule | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_RULE); setModalOpen(true); }
  function openEdit(rule: PricingRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      weight_from_kg: String(rule.weight_from_kg), weight_to_kg: String(rule.weight_to_kg),
      distance_from_km: String(rule.distance_from_km), distance_to_km: String(rule.distance_to_km),
      base_price: String(rule.base_price), per_km_price: String(rule.per_km_price),
      additional_weight_charge: String(rule.additional_weight_charge),
      additional_weight_step_kg: String(rule.additional_weight_step_kg),
      max_charge: rule.max_charge !== null ? String(rule.max_charge) : '',
      customer_type: rule.customer_type, priority: String(rule.priority), is_active: rule.is_active,
    });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      name: form.name.trim(),
      weight_from_kg: Number(form.weight_from_kg), weight_to_kg: Number(form.weight_to_kg),
      distance_from_km: Number(form.distance_from_km), distance_to_km: Number(form.distance_to_km),
      base_price: Number(form.base_price), per_km_price: Number(form.per_km_price),
      additional_weight_charge: Number(form.additional_weight_charge),
      additional_weight_step_kg: Number(form.additional_weight_step_kg) || 1,
      max_charge: form.max_charge ? Number(form.max_charge) : null,
      customer_type: form.customer_type, priority: Number(form.priority) || 0,
      is_active: form.is_active,
    };
    if (editing) await rules.update(editing.id, values);
    else await rules.create(values);
    setModalOpen(false);
  }

  const invalid =
    !form.name.trim() || !form.weight_to_kg || !form.distance_to_km || !form.base_price ||
    Number(form.weight_to_kg) <= Number(form.weight_from_kg) ||
    Number(form.distance_to_km) < Number(form.distance_from_km);

  const columns: Column<PricingRule>[] = [
    {
      key: 'name', header: 'Rule',
      render: (r) => (
        <div>
          <p className="font-medium text-ink">{r.name}</p>
          <p className="text-sm text-ink-muted">
            {r.weight_from_kg}–{r.weight_to_kg} kg · {r.distance_from_km}–{r.distance_to_km} km
          </p>
        </div>
      ),
    },
    { key: 'base', header: 'Base', hideOnMobile: true, render: (r) => money(r.base_price) },
    { key: 'perkm', header: 'Per km', hideOnMobile: true, render: (r) => money(r.per_km_price) },
    {
      key: 'type', header: 'Customer',
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={r.customer_type === 'business' ? 'primary' : 'neutral'}>
            {r.customer_type === 'business' ? 'Business' : 'Individual'}
          </Badge>
          {!r.is_active && <Badge tone="danger">Disabled</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add rate rule</Button>
      </div>
      <Card>
        {rules.isLoading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : rules.error ? (
          <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
        ) : rules.rows.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-6 w-6" />}
            title="No rate rules yet"
            description="Without a rule, the calculator and booking form cannot price anything. Add at least one rule covering your typical weight and distance range."
            action={<Button onClick={openCreate}>Add rate rule</Button>}
          />
        ) : (
          <DataTable columns={columns} rows={rules.rows} onRowClick={openEdit}
            rowActions={(r) => (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDeleteTarget(r)}>
                <span className="hidden lg:inline">Delete</span>
              </Button>
            )} />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={editing ? 'Edit rate rule' : 'Add rate rule'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={rules.creating || rules.updating} disabled={invalid}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Rule name" hint="For your own reference, e.g. “0–1 kg local”"
            value={form.name} required onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Weight from (kg)" type="number" min="0" step="0.1" value={form.weight_from_kg}
              onChange={(e) => setForm((f) => ({ ...f, weight_from_kg: e.target.value }))} />
            <Input label="Weight to (kg)" type="number" min="0" step="0.1" value={form.weight_to_kg} required
              onChange={(e) => setForm((f) => ({ ...f, weight_to_kg: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Distance from (km)" type="number" min="0" step="0.1" value={form.distance_from_km}
              onChange={(e) => setForm((f) => ({ ...f, distance_from_km: e.target.value }))} />
            <Input label="Distance to (km)" type="number" min="0" step="0.1" value={form.distance_to_km} required
              onChange={(e) => setForm((f) => ({ ...f, distance_to_km: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Base price" prefix="₹" type="number" min="0" step="1" value={form.base_price} required
              onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} />
            <Input label="Price per km" prefix="₹" type="number" min="0" step="1" value={form.per_km_price}
              onChange={(e) => setForm((f) => ({ ...f, per_km_price: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Extra weight charge" prefix="₹" type="number" min="0" step="1"
              value={form.additional_weight_charge}
              hint={`Charged per ${form.additional_weight_step_kg || 1} kg above the band minimum`}
              onChange={(e) => setForm((f) => ({ ...f, additional_weight_charge: e.target.value }))} />
            <Input label="Extra weight step (kg)" type="number" min="0.1" step="0.1"
              value={form.additional_weight_step_kg}
              onChange={(e) => setForm((f) => ({ ...f, additional_weight_step_kg: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Maximum charge" prefix="₹" hint="Optional cap" type="number" min="0" step="1"
              value={form.max_charge} onChange={(e) => setForm((f) => ({ ...f, max_charge: e.target.value }))} />
            <Input label="Priority" hint="Higher wins on overlapping rules" type="number" value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
          </div>
          <Select label="Applies to" value={form.customer_type}
            onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value as CustomerType }))}>
            <option value="individual">Individual customers</option>
            <option value="business">Business customers</option>
          </Select>
          <Checkbox label="Active" description="Inactive rules are ignored by the calculator and booking."
            checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await rules.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this rate rule?"
        message="Orders already placed keep their frozen price. This only affects future bookings."
        confirmLabel="Delete" tone="danger" loading={rules.removing} />
    </div>
  );
}

/* ==================================================================== */
/* Distance matrix                                                      */
/* ==================================================================== */

function DistanceMatrixTab() {
  const areas = useServiceAreas();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<{ a: string; b: string } | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const rowsQuery = useQuery({
    queryKey: ['admin', 'distance_matrix'],
    enabled: isSupabaseConfigured,
    queryFn: listDistanceRows,
  });

  const areaList = areas.data ?? [];
  const cells = buildMatrix(areaList, rowsQuery.data ?? []);
  const coverage = matrixCoverage(cells);
  const cellAt = (a: string, b: string) =>
    cells.find((c) => (c.areaAId === a && c.areaBId === b) || (c.areaAId === b && c.areaBId === a));

  function openCell(a: string, b: string) {
    const cell = cellAt(a, b);
    setEditingCell({ a, b });
    setValue(cell?.distanceKm !== null && cell?.distanceKm !== undefined ? String(cell.distanceKm) : '');
  }

  async function save() {
    if (!editingCell) return;
    const km = Number(value);
    if (!Number.isFinite(km) || km < 0) {
      toast.error('Enter a distance of zero or more');
      return;
    }
    setSaving(true);
    try {
      await upsertDistance(editingCell.a, editingCell.b, km);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'distance_matrix'] });
      toast.success('Distance saved');
      setEditingCell(null);
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!editingCell) return;
    const cell = cellAt(editingCell.a, editingCell.b);
    if (!cell?.rowId) { setEditingCell(null); return; }
    setSaving(true);
    try {
      await deleteDistance(cell.rowId);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'distance_matrix'] });
      toast.success('Distance removed');
      setEditingCell(null);
    } catch (err) {
      toast.error('Could not remove', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (areas.isLoading || rowsQuery.isLoading) return <Card><SkeletonTable rows={5} columns={5} /></Card>;
  if (areas.error) return <Card><ErrorState error={areas.error} onRetry={() => areas.refetch()} /></Card>;
  if (rowsQuery.error) return <Card><ErrorState error={rowsQuery.error} onRetry={() => rowsQuery.refetch()} /></Card>;

  if (areaList.length < 1) {
    return (
      <Card>
        <EmptyState icon={<Ruler className="h-6 w-6" />} title="Add service areas first"
          description="The distance matrix is built from your service areas. Add at least two areas to start filling it in." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Tap any cell to set the distance between two areas. Pricing and the calculator depend on
          this being filled in.
        </p>
        <Badge tone={coverage.percent === 100 ? 'success' : 'warning'}>
          {coverage.filled} of {coverage.total} pairs set
        </Badge>
      </div>

      <Card className="overflow-x-auto p-3">
        <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
          <thead>
            <tr>
              <th className="w-28" />
              {areaList.map((a) => (
                <th key={a.id} className="min-w-[84px] p-1 text-center text-xs font-medium text-ink-muted">
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areaList.map((rowArea) => (
              <tr key={rowArea.id}>
                <th className="p-1 text-right text-xs font-medium text-ink-muted">{rowArea.name}</th>
                {areaList.map((colArea) => {
                  const cell = cellAt(rowArea.id, colArea.id);
                  const isSelf = rowArea.id === colArea.id;
                  return (
                    <td key={colArea.id}>
                      <button
                        type="button"
                        onClick={() => openCell(rowArea.id, colArea.id)}
                        className={cn(
                          'flex h-11 w-full min-w-[84px] items-center justify-center rounded-card border text-sm transition-colors',
                          cell?.distanceKm !== null
                            ? 'border-primary/20 bg-primary/5 font-medium text-primary hover:border-primary/40'
                            : 'border-dashed border-line text-ink-muted hover:border-primary/30',
                          isSelf && 'bg-canvas',
                        )}
                      >
                        {cell?.distanceKm !== null && cell?.distanceKm !== undefined
                          ? `${cell.distanceKm} km`
                          : '—'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={Boolean(editingCell)}
        onClose={() => setEditingCell(null)}
        title="Set distance"
        size="sm"
        description={
          editingCell
            ? `${areaList.find((a) => a.id === editingCell.a)?.name} ↔ ${areaList.find((a) => a.id === editingCell.b)?.name}`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={clear} disabled={saving}>Clear</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        <Input label="Distance (km)" type="number" min="0" step="0.1" autoFocus
          value={value} onChange={(e) => setValue(e.target.value)} />
      </Modal>
    </div>
  );
}

/* ==================================================================== */
/* Page                                                                  */
/* ==================================================================== */

export default function PricingAreas() {
  const [tab, setTab] = useState('areas');

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Pricing & areas" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Pricing & areas"
        description="Where you operate, the rate chart, and the distance between areas."
      />
      <Tabs
        items={[
          { key: 'areas', label: 'Service areas' },
          { key: 'pricing', label: 'Rate chart' },
          { key: 'distance', label: 'Distance matrix' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'areas' && <ServiceAreasTab />}
      {tab === 'pricing' && <PricingRulesTab />}
      {tab === 'distance' && <DistanceMatrixTab />}
    </div>
  );
}
