import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, CalendarOff, Clock, FileText, Image as ImageIcon, Plus, ShieldAlert,
  Tags, Trash2,
} from 'lucide-react';
import { AdminPageHeader, DataTable, Tabs, type Column } from '@/components/admin/AdminUI';
import { Badge, Button, Card, Checkbox, Input, Select, Switch, Textarea } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { EmptyState, ErrorState, NotConnectedState, SkeletonTable } from '@/components/ui/states';
import { useAdminList } from '@/hooks/useAdminList';
import { useServiceAreas, DAY_NAMES } from '@/hooks/useCatalog';
import { list, update } from '@/services/crud';
import { useToast } from '@/providers/ToastProvider';
import { isSupabaseConfigured, requireClient } from '@/lib/supabase';
import { money, shortDate } from '@/lib/format';
import type {
  Banner, ContentSection, CustomerType, DiscountType, Faq, Holiday, Offer,
  SafetyRule, ServiceItem, TimeWindow, WorkingHour,
} from '@/types/database';

/* ==================================================================== */
/* Website content sections                                             */
/* ==================================================================== */

const PAGES = [
  { key: 'home', label: 'Homepage' },
  { key: 'about', label: 'About' },
  { key: 'business', label: 'Business' },
  { key: 'contact', label: 'Contact' },
  { key: 'safety', label: 'Safety & rules' },
  { key: 'privacy', label: 'Privacy policy' },
  { key: 'terms', label: 'Terms & conditions' },
];

interface SectionForm {
  section_key: string; title: string; subtitle: string; description: string;
  image_url: string; cta_text: string; cta_link: string; is_active: boolean;
}
const EMPTY_SECTION: SectionForm = {
  section_key: '', title: '', subtitle: '', description: '', image_url: '', cta_text: '', cta_link: '', is_active: true,
};

function ContentSectionsTab() {
  const [page, setPage] = useState('home');
  const queryClient = useQueryClient();
  const toast = useToast();

  const sectionsQuery = useQuery({
    queryKey: ['admin', 'content_sections', page],
    enabled: isSupabaseConfigured,
    queryFn: () => list<ContentSection>('content_sections', { filters: { page }, orderBy: 'display_order' }),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentSection | null>(null);
  const [form, setForm] = useState<SectionForm>(EMPTY_SECTION);
  const [deleteTarget, setDeleteTarget] = useState<ContentSection | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'content_sections', page] });

  function openCreate() { setEditing(null); setForm(EMPTY_SECTION); setModalOpen(true); }
  function openEdit(section: ContentSection) {
    setEditing(section);
    setForm({
      section_key: section.section_key, title: section.title ?? '', subtitle: section.subtitle ?? '',
      description: section.description ?? '', image_url: section.image_url ?? '',
      cta_text: section.cta_text ?? '', cta_link: section.cta_link ?? '', is_active: section.is_active,
    });
    setModalOpen(true);
  }

  async function onSave() {
    setSaving(true);
    try {
      const values = {
        page, section_key: form.section_key.trim(),
        title: form.title.trim() || null, subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null, image_url: form.image_url.trim() || null,
        cta_text: form.cta_text.trim() || null, cta_link: form.cta_link.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        await update('content_sections', editing.id, values);
      } else {
        const client = requireClient();
        const { error } = await client.from('content_sections').insert({
          ...values, display_order: (sectionsQuery.data?.length ?? 0) + 1,
        });
        if (error) throw error;
      }
      await invalidate();
      toast.success('Saved');
      setModalOpen(false);
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      const client = requireClient();
      const { error } = await client.from('content_sections').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await invalidate();
      toast.success('Deleted');
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleteTarget(null);
    }
  }

  const rows = sectionsQuery.data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select value={page} onChange={(e) => setPage(e.target.value)} className="w-auto">
          {PAGES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add section</Button>
      </div>

      <Card>
        {sectionsQuery.isLoading ? (
          <SkeletonTable rows={4} columns={3} />
        ) : sectionsQuery.error ? (
          <ErrorState error={sectionsQuery.error} onRetry={() => sectionsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No sections for this page yet"
            description="Add a section to start writing content for this page."
            action={<Button onClick={openCreate}>Add section</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((section) => (
              <li key={section.id} className="flex items-center justify-between gap-4 p-4">
                <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(section)}>
                  <p className="font-mono text-xs text-ink-muted">{section.section_key}</p>
                  <p className="mt-0.5 truncate font-medium text-ink">{section.title || '(no title)'}</p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {!section.is_active && <Badge tone="danger">Hidden</Badge>}
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleteTarget(section)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={editing ? 'Edit section' : 'Add section'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={saving} disabled={!form.section_key.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Section key" hint="Identifies this block — leave existing keys as they are"
            value={form.section_key} disabled={Boolean(editing)}
            onChange={(e) => setForm((f) => ({ ...f, section_key: e.target.value.trim().toLowerCase().replace(/\s+/g, '_') }))} />
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Subtitle" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          <Textarea label="Description / body text" rows={4} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Image URL" hint="Upload in Media, then paste the URL here" value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Button text" value={form.cta_text} onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))} />
            <Input label="Button link" value={form.cta_link} onChange={(e) => setForm((f) => ({ ...f, cta_link: e.target.value }))} />
          </div>
          <Switch label="Visible on the site" checked={form.is_active}
            onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={onDelete}
        title="Delete this section?" message="This block will be removed from the page entirely."
        confirmLabel="Delete" tone="danger" />
    </div>
  );
}

/* ==================================================================== */
/* Banners                                                               */
/* ==================================================================== */

interface BannerForm {
  title: string; subtitle: string; description: string; image_desktop: string; image_mobile: string;
  button_text: string; button_link: string; starts_at: string; ends_at: string; auto_slide: boolean; is_active: boolean;
}
const EMPTY_BANNER: BannerForm = {
  title: '', subtitle: '', description: '', image_desktop: '', image_mobile: '',
  button_text: '', button_link: '', starts_at: '', ends_at: '', auto_slide: true, is_active: true,
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function BannersTab() {
  const banners = useAdminList<Banner>('banners', { orderBy: 'display_order' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_BANNER);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_BANNER); setModalOpen(true); }
  function openEdit(banner: Banner) {
    setEditing(banner);
    setForm({
      title: banner.title, subtitle: banner.subtitle ?? '', description: banner.description ?? '',
      image_desktop: banner.image_desktop ?? '', image_mobile: banner.image_mobile ?? '',
      button_text: banner.button_text ?? '', button_link: banner.button_link ?? '',
      starts_at: toDatetimeLocal(banner.starts_at), ends_at: toDatetimeLocal(banner.ends_at),
      auto_slide: banner.auto_slide, is_active: banner.is_active,
    });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      title: form.title.trim(), subtitle: form.subtitle.trim() || null, description: form.description.trim() || null,
      image_desktop: form.image_desktop.trim() || null, image_mobile: form.image_mobile.trim() || null,
      button_text: form.button_text.trim() || null, button_link: form.button_link.trim() || null,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      auto_slide: form.auto_slide, is_active: form.is_active,
      display_order: editing?.display_order ?? banners.rows.length + 1,
    };
    if (editing) await banners.update(editing.id, values);
    else await banners.create(values);
    setModalOpen(false);
  }

  const columns: Column<Banner>[] = [
    {
      key: 'title', header: 'Banner',
      render: (b) => (
        <div className="flex items-center gap-3">
          {b.image_desktop && <img src={b.image_desktop} alt="" className="h-10 w-16 rounded object-cover" />}
          <span className="font-medium text-ink">{b.title}</span>
        </div>
      ),
    },
    {
      key: 'window', header: 'Active window', hideOnMobile: true,
      render: (b) => (b.starts_at || b.ends_at
        ? `${b.starts_at ? shortDate(b.starts_at) : 'Any time'} – ${b.ends_at ? shortDate(b.ends_at) : 'ongoing'}`
        : 'Always'),
    },
    {
      key: 'status', header: 'Status',
      render: (b) => !b.is_active ? <Badge tone="danger">Hidden</Badge> : <Badge tone="success">Live</Badge>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add banner</Button>
      </div>
      <Card>
        {banners.isLoading ? (
          <SkeletonTable rows={3} columns={3} />
        ) : banners.error ? (
          <ErrorState error={banners.error} onRetry={() => banners.refetch()} />
        ) : banners.rows.length === 0 ? (
          <EmptyState icon={<ImageIcon className="h-6 w-6" />} title="No banners yet"
            description="Without a banner, the homepage shows a text-only hero built from your homepage content."
            action={<Button onClick={openCreate}>Add banner</Button>} />
        ) : (
          <DataTable columns={columns} rows={banners.rows} onRowClick={openEdit}
            rowActions={(b) => (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(b)} />
            )} />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={editing ? 'Edit banner' : 'Add banner'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={banners.creating || banners.updating} disabled={!form.title.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Title" value={form.title} required onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Subtitle" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Desktop image URL" value={form.image_desktop} onChange={(e) => setForm((f) => ({ ...f, image_desktop: e.target.value }))} />
          <Input label="Mobile image URL" hint="Optional — falls back to the desktop image" value={form.image_mobile}
            onChange={(e) => setForm((f) => ({ ...f, image_mobile: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Button text" value={form.button_text} onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))} />
            <Input label="Button link" value={form.button_link} onChange={(e) => setForm((f) => ({ ...f, button_link: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Starts" type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
            <Input label="Ends" type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
          </div>
          <Checkbox label="Auto-advance" description="Only applies when more than one banner is live."
            checked={form.auto_slide} onChange={(e) => setForm((f) => ({ ...f, auto_slide: e.target.checked }))} />
          <Checkbox label="Active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await banners.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this banner?" message="It will be removed from the homepage." confirmLabel="Delete" tone="danger"
        loading={banners.removing} />
    </div>
  );
}

/* ==================================================================== */
/* Services                                                              */
/* ==================================================================== */

interface ServiceForm { name: string; description: string; image_url: string; is_active: boolean; }
const EMPTY_SERVICE: ServiceForm = { name: '', description: '', image_url: '', is_active: true };

function ServicesTab() {
  const services = useAdminList<ServiceItem>('services', { orderBy: 'display_order' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_SERVICE);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_SERVICE); setModalOpen(true); }
  function openEdit(s: ServiceItem) {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? '', image_url: s.image_url ?? '', is_active: s.is_active });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      name: form.name.trim(), description: form.description.trim() || null, image_url: form.image_url.trim() || null,
      is_active: form.is_active, display_order: editing?.display_order ?? services.rows.length + 1,
    };
    if (editing) await services.update(editing.id, values);
    else await services.create(values);
    setModalOpen(false);
  }

  const columns: Column<ServiceItem>[] = [
    { key: 'name', header: 'Service', render: (s) => <span className="font-medium text-ink">{s.name}</span> },
    { key: 'desc', header: 'Description', hideOnMobile: true, render: (s) => <span className="text-ink-muted">{s.description ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (s) => !s.is_active ? <Badge tone="danger">Hidden</Badge> : <Badge tone="success">Visible</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add service</Button>
      </div>
      <Card>
        {services.isLoading ? (
          <SkeletonTable rows={3} columns={3} />
        ) : services.error ? (
          <ErrorState error={services.error} onRetry={() => services.refetch()} />
        ) : services.rows.length === 0 ? (
          <EmptyState icon={<Tags className="h-6 w-6" />} title="No services listed yet"
            description="Add the kinds of delivery you offer — these show on the homepage and services page."
            action={<Button onClick={openCreate}>Add service</Button>} />
        ) : (
          <DataTable columns={columns} rows={services.rows} onRowClick={openEdit}
            rowActions={(s) => (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(s)} />
            )} />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit service' : 'Add service'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={services.creating || services.updating} disabled={!form.name.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Name" value={form.name} required onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Image URL" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
          <Checkbox label="Visible on the site" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await services.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this service?" message="It will no longer be listed on the site." confirmLabel="Delete" tone="danger"
        loading={services.removing} />
    </div>
  );
}

/* ==================================================================== */
/* Offers                                                                */
/* ==================================================================== */

interface OfferForm {
  name: string; code: string; description: string; discount_type: DiscountType; discount_value: string;
  min_order_value: string; max_discount: string; service_area_id: string; customer_type: '' | CustomerType;
  starts_at: string; ends_at: string; usage_limit: string; is_active: boolean;
}
const EMPTY_OFFER: OfferForm = {
  name: '', code: '', description: '', discount_type: 'percentage', discount_value: '',
  min_order_value: '0', max_discount: '', service_area_id: '', customer_type: '',
  starts_at: '', ends_at: '', usage_limit: '', is_active: true,
};

function OffersTab() {
  const offers = useAdminList<Offer>('offers', { orderBy: 'created_at', ascending: false });
  const areas = useServiceAreas();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(EMPTY_OFFER);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_OFFER); setModalOpen(true); }
  function openEdit(offer: Offer) {
    setEditing(offer);
    setForm({
      name: offer.name, code: offer.code ?? '', description: offer.description ?? '',
      discount_type: offer.discount_type, discount_value: String(offer.discount_value),
      min_order_value: String(offer.min_order_value), max_discount: offer.max_discount !== null ? String(offer.max_discount) : '',
      service_area_id: offer.service_area_id ?? '', customer_type: offer.customer_type ?? '',
      starts_at: toDatetimeLocal(offer.starts_at), ends_at: toDatetimeLocal(offer.ends_at),
      usage_limit: offer.usage_limit !== null ? String(offer.usage_limit) : '', is_active: offer.is_active,
    });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      name: form.name.trim(), code: form.code.trim() || null, description: form.description.trim() || null,
      discount_type: form.discount_type, discount_value: Number(form.discount_value),
      min_order_value: Number(form.min_order_value) || 0,
      max_discount: form.max_discount ? Number(form.max_discount) : null,
      service_area_id: form.service_area_id || null,
      customer_type: form.customer_type || null,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      is_active: form.is_active,
    };
    if (editing) await offers.update(editing.id, values);
    else await offers.create(values);
    setModalOpen(false);
  }

  const columns: Column<Offer>[] = [
    { key: 'name', header: 'Offer', render: (o) => (
      <div>
        <p className="font-medium text-ink">{o.name}</p>
        {o.code && <p className="font-mono text-xs text-ink-muted">{o.code}</p>}
      </div>
    ) },
    { key: 'discount', header: 'Discount', hideOnMobile: true,
      render: (o) => o.discount_type === 'percentage' ? `${o.discount_value}%` : money(o.discount_value) },
    { key: 'used', header: 'Used', hideOnMobile: true,
      render: (o) => `${o.used_count}${o.usage_limit ? ` / ${o.usage_limit}` : ''}` },
    { key: 'status', header: 'Status', render: (o) => !o.is_active ? <Badge tone="danger">Off</Badge> : <Badge tone="success">Live</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add offer</Button>
      </div>
      <Card>
        {offers.isLoading ? (
          <SkeletonTable rows={3} columns={4} />
        ) : offers.error ? (
          <ErrorState error={offers.error} onRetry={() => offers.refetch()} />
        ) : offers.rows.length === 0 ? (
          <EmptyState icon={<Tags className="h-6 w-6" />} title="No offers yet"
            description="Discounts you create here appear on the homepage and offers page while active."
            action={<Button onClick={openCreate}>Add offer</Button>} />
        ) : (
          <DataTable columns={columns} rows={offers.rows} onRowClick={openEdit}
            rowActions={(o) => (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(o)} />
            )} />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg" title={editing ? 'Edit offer' : 'Add offer'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={offers.creating || offers.updating}
              disabled={!form.name.trim() || !form.discount_value}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Offer name" value={form.name} required onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Code" hint="Optional" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Discount type" value={form.discount_type}
              onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as DiscountType }))}>
              <option value="percentage">Percentage</option>
              <option value="flat">Flat amount</option>
            </Select>
            <Input label={form.discount_type === 'percentage' ? 'Discount (%)' : 'Discount amount'}
              type="number" min="0" value={form.discount_value} required
              onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Minimum order value" prefix="₹" type="number" min="0" value={form.min_order_value}
              onChange={(e) => setForm((f) => ({ ...f, min_order_value: e.target.value }))} />
            <Input label="Maximum discount" prefix="₹" hint="Optional cap" type="number" min="0" value={form.max_discount}
              onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Limit to area" placeholder="All areas" value={form.service_area_id}
              onChange={(e) => setForm((f) => ({ ...f, service_area_id: e.target.value }))}>
              {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Select label="Limit to customer type" placeholder="Any" value={form.customer_type}
              onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value as CustomerType | '' }))}>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Starts" type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
            <Input label="Ends" type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
          </div>
          <Input label="Usage limit" hint="Optional — total times this offer can be used" type="number" min="0"
            value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} />
          <Checkbox label="Active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await offers.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this offer?" message="Orders that already used it keep their recorded discount." confirmLabel="Delete"
        tone="danger" loading={offers.removing} />
    </div>
  );
}

/* ==================================================================== */
/* FAQ                                                                   */
/* ==================================================================== */

interface FaqForm { question: string; answer: string; category: string; is_active: boolean; }
const EMPTY_FAQ: FaqForm = { question: '', answer: '', category: '', is_active: true };

function FaqTab() {
  const faqs = useAdminList<Faq>('faqs', { orderBy: 'display_order' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<FaqForm>(EMPTY_FAQ);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_FAQ); setModalOpen(true); }
  function openEdit(faq: Faq) {
    setEditing(faq);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category ?? '', is_active: faq.is_active });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      question: form.question.trim(), answer: form.answer.trim(), category: form.category.trim() || null,
      is_active: form.is_active, display_order: editing?.display_order ?? faqs.rows.length + 1,
    };
    if (editing) await faqs.update(editing.id, values);
    else await faqs.create(values);
    setModalOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add question</Button>
      </div>
      <Card>
        {faqs.isLoading ? (
          <SkeletonTable rows={3} columns={2} />
        ) : faqs.error ? (
          <ErrorState error={faqs.error} onRetry={() => faqs.refetch()} />
        ) : faqs.rows.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No FAQs published yet"
            description="Common questions and answers shown on the FAQ page and homepage."
            action={<Button onClick={openCreate}>Add question</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {faqs.rows.map((faq) => (
              <li key={faq.id} className="flex items-center justify-between gap-4 p-4">
                <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(faq)}>
                  <p className="truncate font-medium text-ink">{faq.question}</p>
                  {faq.category && <p className="text-xs text-ink-muted">{faq.category}</p>}
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {!faq.is_active && <Badge tone="danger">Hidden</Badge>}
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(faq)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit question' : 'Add question'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={faqs.creating || faqs.updating} disabled={!form.question.trim() || !form.answer.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Question" value={form.question} required onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
          <Textarea label="Answer" rows={4} value={form.answer} required onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} />
          <Input label="Category" hint="Optional — groups related questions" value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <Checkbox label="Visible on the site" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await faqs.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this question?" message="It will be removed from the FAQ page." confirmLabel="Delete" tone="danger"
        loading={faqs.removing} />
    </div>
  );
}

/* ==================================================================== */
/* Safety rules                                                         */
/* ==================================================================== */

interface SafetyForm { category: string; title: string; description: string; is_active: boolean; }
const EMPTY_SAFETY: SafetyForm = { category: '', title: '', description: '', is_active: true };

function SafetyTab() {
  const rules = useAdminList<SafetyRule>('safety_rules', { orderBy: 'display_order' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SafetyRule | null>(null);
  const [form, setForm] = useState<SafetyForm>(EMPTY_SAFETY);
  const [deleteTarget, setDeleteTarget] = useState<SafetyRule | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY_SAFETY); setModalOpen(true); }
  function openEdit(rule: SafetyRule) {
    setEditing(rule);
    setForm({ category: rule.category, title: rule.title, description: rule.description ?? '', is_active: rule.is_active });
    setModalOpen(true);
  }
  async function onSave() {
    const values = {
      category: form.category.trim().toLowerCase().replace(/\s+/g, '_'), title: form.title.trim(),
      description: form.description.trim() || null, is_active: form.is_active,
      display_order: editing?.display_order ?? rules.rows.length + 1,
    };
    if (editing) await rules.update(editing.id, values);
    else await rules.create(values);
    setModalOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add rule</Button>
      </div>
      <Card>
        {rules.isLoading ? (
          <SkeletonTable rows={3} columns={2} />
        ) : rules.error ? (
          <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
        ) : rules.rows.length === 0 ? (
          <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No safety rules published yet"
            description="Prohibited items, packing requirements and cancellation terms shown on the Safety page."
            action={<Button onClick={openCreate}>Add rule</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {rules.rows.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-4 p-4">
                <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(rule)}>
                  <p className="text-xs uppercase tracking-wide text-ink-muted">{rule.category.replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 truncate font-medium text-ink">{rule.title}</p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {!rule.is_active && <Badge tone="danger">Hidden</Badge>}
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(rule)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit rule' : 'Add rule'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={onSave} loading={rules.creating || rules.updating} disabled={!form.title.trim() || !form.category.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Category" hint="e.g. prohibited_items, packaging, cancellation" value={form.category} required
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <Input label="Title" value={form.title} required onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Checkbox label="Visible on the site" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await rules.remove(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete this rule?" message="It will be removed from the Safety page." confirmLabel="Delete" tone="danger"
        loading={rules.removing} />
    </div>
  );
}

/* ==================================================================== */
/* Hours: working hours, time windows, holidays                         */
/* ==================================================================== */

function HoursTab() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const hoursQuery = useQuery({
    queryKey: ['admin', 'working_hours'],
    enabled: isSupabaseConfigured,
    queryFn: () => list<WorkingHour>('working_hours', { orderBy: 'day_of_week' }),
  });

  const windows = useAdminList<TimeWindow>('time_windows', { orderBy: 'display_order' });
  const holidays = useAdminList<Holiday>('holidays', { orderBy: 'date' });

  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [windowForm, setWindowForm] = useState({ kind: 'pickup' as 'pickup' | 'delivery', label: '', starts_at: '09:00', ends_at: '18:00' });
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: '', label: '' });
  const [deleteWindow, setDeleteWindow] = useState<TimeWindow | null>(null);
  const [deleteHoliday, setDeleteHoliday] = useState<Holiday | null>(null);

  async function saveDay(day: WorkingHour) {
    setSavingDay(day.day_of_week);
    try {
      const client = requireClient();
      const { error } = await client
        .from('working_hours')
        .update({ is_open: day.is_open, opens_at: day.opens_at, closes_at: day.closes_at })
        .eq('day_of_week', day.day_of_week);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['admin', 'working_hours'] });
      toast.success('Hours saved');
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingDay(null);
    }
  }

  function updateLocalDay(day: number, patch: Partial<WorkingHour>) {
    queryClient.setQueryData<WorkingHour[]>(['admin', 'working_hours'], (prev) =>
      (prev ?? []).map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)),
    );
  }

  async function saveWindow() {
    const values = {
      kind: windowForm.kind, label: windowForm.label.trim(),
      starts_at: windowForm.starts_at, ends_at: windowForm.ends_at,
      display_order: windows.rows.length + 1, is_active: true,
    };
    await windows.create(values);
    setWindowModalOpen(false);
    setWindowForm({ kind: 'pickup', label: '', starts_at: '09:00', ends_at: '18:00' });
  }

  async function saveHoliday() {
    await holidays.create({ date: holidayForm.date, label: holidayForm.label.trim() });
    setHolidayModalOpen(false);
    setHolidayForm({ date: '', label: '' });
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="border-b border-line p-4 sm:p-5">
          <h3 className="text-base font-semibold text-ink">Opening hours</h3>
          <p className="mt-1 text-sm text-ink-muted">Shown on the Contact page. Leave times blank if you keep flexible hours.</p>
        </div>
        {hoursQuery.isLoading ? (
          <SkeletonTable rows={7} columns={4} />
        ) : hoursQuery.error ? (
          <ErrorState error={hoursQuery.error} onRetry={() => hoursQuery.refetch()} />
        ) : (
          <ul className="divide-y divide-line">
            {(hoursQuery.data ?? []).map((day) => (
              <li key={day.day_of_week} className="flex flex-wrap items-center gap-3 p-4">
                <span className="w-24 shrink-0 text-sm font-medium text-ink">{DAY_NAMES[day.day_of_week]}</span>
                <Switch label="" checked={day.is_open} onChange={(v) => updateLocalDay(day.day_of_week, { is_open: v })} />
                {day.is_open && (
                  <>
                    <Input type="time" className="w-32" value={day.opens_at ?? ''}
                      onChange={(e) => updateLocalDay(day.day_of_week, { opens_at: e.target.value || null })} />
                    <span className="text-ink-muted">to</span>
                    <Input type="time" className="w-32" value={day.closes_at ?? ''}
                      onChange={(e) => updateLocalDay(day.day_of_week, { closes_at: e.target.value || null })} />
                  </>
                )}
                <Button size="sm" variant="outline" className="ml-auto" loading={savingDay === day.day_of_week}
                  onClick={() => saveDay(day)}>
                  Save
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <div>
            <h3 className="text-base font-semibold text-ink">Pickup & delivery windows</h3>
            <p className="mt-1 text-sm text-ink-muted">Offered as time slot choices during booking.</p>
          </div>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setWindowModalOpen(true)}>Add</Button>
        </div>
        {windows.isLoading ? <SkeletonTable rows={2} columns={3} /> : windows.rows.length === 0 ? (
          <EmptyState icon={<Clock className="h-6 w-6" />} title="No time windows set"
            description="Without these, customers won't see slot options and timing is confirmed directly." />
        ) : (
          <ul className="divide-y divide-line">
            {windows.rows.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-ink">{w.label}</p>
                  <p className="text-sm text-ink-muted capitalize">{w.kind} · {w.starts_at.slice(0, 5)}–{w.ends_at.slice(0, 5)}</p>
                </div>
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteWindow(w)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <div>
            <h3 className="text-base font-semibold text-ink">Holidays</h3>
            <p className="mt-1 text-sm text-ink-muted">Dates you don't operate — for your own reference.</p>
          </div>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setHolidayModalOpen(true)}>Add</Button>
        </div>
        {holidays.isLoading ? <SkeletonTable rows={2} columns={2} /> : holidays.rows.length === 0 ? (
          <EmptyState icon={<CalendarOff className="h-6 w-6" />} title="No holidays added" />
        ) : (
          <ul className="divide-y divide-line">
            {holidays.rows.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-ink">{h.label}</p>
                  <p className="text-sm text-ink-muted">{shortDate(h.date)}</p>
                </div>
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteHoliday(h)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={windowModalOpen} onClose={() => setWindowModalOpen(false)} title="Add time window" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setWindowModalOpen(false)}>Cancel</Button>
            <Button onClick={saveWindow} disabled={!windowForm.label.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Select label="Type" value={windowForm.kind}
            onChange={(e) => setWindowForm((f) => ({ ...f, kind: e.target.value as 'pickup' | 'delivery' }))}>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </Select>
          <Input label="Label" placeholder="Morning (9am–1pm)" value={windowForm.label}
            onChange={(e) => setWindowForm((f) => ({ ...f, label: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Starts" type="time" value={windowForm.starts_at}
              onChange={(e) => setWindowForm((f) => ({ ...f, starts_at: e.target.value }))} />
            <Input label="Ends" type="time" value={windowForm.ends_at}
              onChange={(e) => setWindowForm((f) => ({ ...f, ends_at: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal open={holidayModalOpen} onClose={() => setHolidayModalOpen(false)} title="Add holiday" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setHolidayModalOpen(false)}>Cancel</Button>
            <Button onClick={saveHoliday} disabled={!holidayForm.date || !holidayForm.label.trim()}>Save</Button>
          </>
        }>
        <div className="grid gap-4">
          <Input label="Date" type="date" value={holidayForm.date} onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="Label" value={holidayForm.label} onChange={(e) => setHolidayForm((f) => ({ ...f, label: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteWindow)} onClose={() => setDeleteWindow(null)}
        onConfirm={async () => { if (deleteWindow) await windows.remove(deleteWindow.id); setDeleteWindow(null); }}
        title="Delete this time window?" message="Customers will no longer see this slot when booking." confirmLabel="Delete" tone="danger" />

      <ConfirmDialog open={Boolean(deleteHoliday)} onClose={() => setDeleteHoliday(null)}
        onConfirm={async () => { if (deleteHoliday) await holidays.remove(deleteHoliday.id); setDeleteHoliday(null); }}
        title="Delete this holiday?" message="" confirmLabel="Delete" tone="danger" />
    </div>
  );
}

/* ==================================================================== */
/* Page                                                                  */
/* ==================================================================== */

export default function Catalogue() {
  const [tab, setTab] = useState('content');

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Website content" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Website content" description="Everything shown on the public site, editable without a deploy." />
      <Tabs
        items={[
          { key: 'content', label: 'Page content' },
          { key: 'banners', label: 'Banners' },
          { key: 'services', label: 'Services' },
          { key: 'offers', label: 'Offers' },
          { key: 'faq', label: 'FAQ' },
          { key: 'safety', label: 'Safety rules' },
          { key: 'hours', label: 'Hours' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'content' && <ContentSectionsTab />}
      {tab === 'banners' && <BannersTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'offers' && <OffersTab />}
      {tab === 'faq' && <FaqTab />}
      {tab === 'safety' && <SafetyTab />}
      {tab === 'hours' && <HoursTab />}
    </div>
  );
}
