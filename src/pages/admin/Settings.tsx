import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AdminPageHeader, Tabs } from '@/components/admin/AdminUI';
import { Button, Card, Checkbox, Input, Select, Switch, Textarea } from '@/components/ui';
import { NotConnectedState } from '@/components/ui/states';
import { useSettings } from '@/providers/SettingsProvider';
import { useToast } from '@/providers/ToastProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { SettingsShape } from '@/schemas/settings';

/**
 * The settings editor. Every field here maps directly to a Zod schema
 * in src/schemas/settings.ts — save() validates against that schema
 * before writing, so a malformed value never reaches the database.
 *
 * Each tab keeps its own local draft and only calls save() on submit,
 * so half-edited forms never leak into the live site while typing.
 */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-card border border-line bg-transparent p-0.5"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function SaveBar({ onSave, saving, dirty }: { onSave: () => void; saving: boolean; dirty: boolean }) {
  return (
    <div className="sticky bottom-4 mt-6 flex justify-end">
      <Button onClick={onSave} loading={saving} disabled={!dirty} size="lg">
        Save changes
      </Button>
    </div>
  );
}

function useDomainForm<K extends keyof SettingsShape>(key: K) {
  const { settings, save } = useSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<SettingsShape[K]>(settings[key]);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings[key]), [settings, key]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings[key]);

  async function onSave() {
    setSaving(true);
    try {
      await save(key, draft);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return { draft, setDraft, saving, dirty, onSave };
}

/* ==================================================================== */

function BrandTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('brand');
  return (
    <Card className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Website name" value={draft.websiteName} onChange={(e) => setDraft({ ...draft, websiteName: e.target.value })} />
        <Input label="Brand name" hint="Shown in the header and footer" value={draft.brandName}
          onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} />
      </div>
      <Input label="Tagline" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
      <Textarea label="Brand description" value={draft.brandDescription}
        onChange={(e) => setDraft({ ...draft, brandDescription: e.target.value })} />
      <Input label="Browser tab title" value={draft.browserTitle} onChange={(e) => setDraft({ ...draft, browserTitle: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Logo URL" hint="Upload in Media first" value={draft.logoUrl} onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} />
        <Input label="Footer logo URL" hint="Optional — falls back to the logo above" value={draft.footerLogoUrl}
          onChange={(e) => setDraft({ ...draft, footerLogoUrl: e.target.value })} />
        <Input label="Favicon URL" value={draft.faviconUrl} onChange={(e) => setDraft({ ...draft, faviconUrl: e.target.value })} />
        <Input label="App icon URL" hint="Used for the installable app icon" value={draft.appIconUrl}
          onChange={(e) => setDraft({ ...draft, appIconUrl: e.target.value })} />
      </div>
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function ContactTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('contact');
  return (
    <Card className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Business name" value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} />
        <Input label="Proprietor" value={draft.proprietor} onChange={(e) => setDraft({ ...draft, proprietor: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Country code" value={draft.countryCode} onChange={(e) => setDraft({ ...draft, countryCode: e.target.value.replace(/\D/g, '') })} />
        <Input label="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, '') })} />
        <Input label="WhatsApp" hint="If different from phone" value={draft.whatsapp}
          onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value.replace(/\D/g, '') })} />
      </div>
      <Input label="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Address line 1" value={draft.addressLine1} onChange={(e) => setDraft({ ...draft, addressLine1: e.target.value })} />
        <Input label="Address line 2" value={draft.addressLine2} onChange={(e) => setDraft({ ...draft, addressLine2: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
        <Input label="State" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} />
        <Input label="PIN code" value={draft.pinCode} onChange={(e) => setDraft({ ...draft, pinCode: e.target.value })} />
      </div>
      <Input label="Maps link" value={draft.mapsUrl} onChange={(e) => setDraft({ ...draft, mapsUrl: e.target.value })} />
      <Input label="Business hours note" hint="Optional short line, e.g. “Closed on Sundays”" value={draft.businessHoursNote}
        onChange={(e) => setDraft({ ...draft, businessHoursNote: e.target.value })} />
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function SocialTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('social');
  return (
    <Card className="space-y-4 p-5">
      {(['facebook', 'instagram', 'youtube', 'x', 'linkedin'] as const).map((key) => (
        <Input key={key} label={key === 'x' ? 'X (Twitter)' : key.charAt(0).toUpperCase() + key.slice(1)}
          value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
      ))}
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function ThemeTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('theme');
  return (
    <Card className="space-y-5 p-5">
      <p className="text-sm text-ink-muted">Changes apply across the whole site immediately after saving — no rebuild needed.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ColorField label="Primary" value={draft.primary} onChange={(v) => setDraft({ ...draft, primary: v })} />
        <ColorField label="Primary (dark)" value={draft.primaryDark} onChange={(v) => setDraft({ ...draft, primaryDark: v })} />
        <ColorField label="Primary (light)" value={draft.primaryLight} onChange={(v) => setDraft({ ...draft, primaryLight: v })} />
        <ColorField label="Accent" value={draft.accent} onChange={(v) => setDraft({ ...draft, accent: v })} />
        <ColorField label="Accent (dark)" value={draft.accentDark} onChange={(v) => setDraft({ ...draft, accentDark: v })} />
        <ColorField label="Secondary" value={draft.secondary} onChange={(v) => setDraft({ ...draft, secondary: v })} />
        <ColorField label="Background" value={draft.background} onChange={(v) => setDraft({ ...draft, background: v })} />
        <ColorField label="Surface" value={draft.surface} onChange={(v) => setDraft({ ...draft, surface: v })} />
        <ColorField label="Text" value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
        <ColorField label="Muted text" value={draft.textMuted} onChange={(v) => setDraft({ ...draft, textMuted: v })} />
        <ColorField label="Border" value={draft.border} onChange={(v) => setDraft({ ...draft, border: v })} />
      </div>
      <Input label="Button corner radius (px)" type="number" min="0" max="32" value={String(draft.buttonRadius)}
        onChange={(e) => setDraft({ ...draft, buttonRadius: Number(e.target.value) || 0 })} className="max-w-xs" />
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function NavigationTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('navigation');
  return (
    <Card className="space-y-5 p-5">
      <div>
        <p className="field-label">Menu items</p>
        <div className="space-y-2">
          {draft.items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-card border border-line p-2.5">
              <Input value={item.label} placeholder="Label" className="w-36"
                onChange={(e) => {
                  const items = [...draft.items];
                  items[i] = { ...item, label: e.target.value };
                  setDraft({ ...draft, items });
                }} />
              <Input value={item.path} placeholder="/path" className="w-36"
                onChange={(e) => {
                  const items = [...draft.items];
                  items[i] = { ...item, path: e.target.value };
                  setDraft({ ...draft, items });
                }} />
              <Checkbox label="Visible" checked={item.visible} className="flex-1 border-0 p-0"
                onChange={(e) => {
                  const items = [...draft.items];
                  items[i] = { ...item, visible: e.target.checked };
                  setDraft({ ...draft, items });
                }} />
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) })} />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setDraft({
            ...draft,
            items: [...draft.items, { label: '', path: '/', visible: true, order: draft.items.length + 1 }],
          })}>
          Add menu item
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Booking button label" value={draft.ctaLabel} onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })} />
        <Input label="Booking button link" value={draft.ctaPath} onChange={(e) => setDraft({ ...draft, ctaPath: e.target.value })} />
      </div>
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function HeaderTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('header');
  return (
    <Card className="space-y-4 p-5">
      <Switch label="Show announcement bar" checked={draft.showAnnouncement}
        onChange={(v) => setDraft({ ...draft, showAnnouncement: v })} />
      {draft.showAnnouncement && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Announcement text" value={draft.announcementText}
            onChange={(e) => setDraft({ ...draft, announcementText: e.target.value })} />
          <Input label="Announcement link" hint="Optional" value={draft.announcementLink}
            onChange={(e) => setDraft({ ...draft, announcementLink: e.target.value })} />
        </div>
      )}
      <Switch label="Show call button" checked={draft.showCallButton} onChange={(v) => setDraft({ ...draft, showCallButton: v })} />
      <Switch label="Show WhatsApp button" checked={draft.showWhatsappButton} onChange={(v) => setDraft({ ...draft, showWhatsappButton: v })} />
      <Switch label="Sticky header" description="Stays visible while scrolling" checked={draft.sticky}
        onChange={(v) => setDraft({ ...draft, sticky: v })} />
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function FooterTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('footer');

  function updateSection(i: number, patch: Partial<(typeof draft.sections)[number]>) {
    const sections = [...draft.sections];
    sections[i] = { ...sections[i], ...patch };
    setDraft({ ...draft, sections });
  }
  function updateLink(si: number, li: number, patch: Partial<{ label: string; path: string }>) {
    const sections = [...draft.sections];
    const links = [...sections[si].links];
    links[li] = { ...links[li], ...patch };
    sections[si] = { ...sections[si], links };
    setDraft({ ...draft, sections });
  }

  return (
    <Card className="space-y-5 p-5">
      <Textarea label="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <Input label="Copyright line" hint="Leave blank to use the brand name automatically" value={draft.copyright}
        onChange={(e) => setDraft({ ...draft, copyright: e.target.value })} />
      <Switch label="Show social links" checked={draft.showSocial} onChange={(v) => setDraft({ ...draft, showSocial: v })} />

      <div>
        <p className="field-label">Footer columns</p>
        <div className="space-y-4">
          {draft.sections.map((section, si) => (
            <div key={si} className="rounded-card border border-line p-3.5">
              <div className="flex items-center gap-2">
                <Input value={section.title} placeholder="Column title" className="flex-1"
                  onChange={(e) => updateSection(si, { title: e.target.value })} />
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== si) })} />
              </div>
              <div className="mt-2 space-y-2">
                {section.links.map((link, li) => (
                  <div key={li} className="flex items-center gap-2">
                    <Input value={link.label} placeholder="Label" className="flex-1"
                      onChange={(e) => updateLink(si, li, { label: e.target.value })} />
                    <Input value={link.path} placeholder="/path" className="flex-1"
                      onChange={(e) => updateLink(si, li, { path: e.target.value })} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => updateSection(si, { links: section.links.filter((_, i) => i !== li) })} />
                  </div>
                ))}
                <Button variant="outline" size="sm" icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => updateSection(si, { links: [...section.links, { label: '', path: '/' }] })}>
                  Add link
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setDraft({ ...draft, sections: [...draft.sections, { title: '', links: [] }] })}>
          Add column
        </Button>
      </div>
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function SeoTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('seo');
  return (
    <Card className="space-y-4 p-5">
      <Input label="Page title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <Textarea label="Meta description" value={draft.metaDescription} onChange={(e) => setDraft({ ...draft, metaDescription: e.target.value })} />
      <Input label="Keywords" hint="Comma-separated" value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} />
      <Input label="Social share image URL" value={draft.ogImageUrl} onChange={(e) => setDraft({ ...draft, ogImageUrl: e.target.value })} />
      <Input label="Canonical URL" hint="Optional" value={draft.canonicalUrl} onChange={(e) => setDraft({ ...draft, canonicalUrl: e.target.value })} />
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function PwaTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('pwa');
  return (
    <Card className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="App name" value={draft.appName} onChange={(e) => setDraft({ ...draft, appName: e.target.value })} />
        <Input label="Short name" hint="Under the home screen icon" value={draft.shortName}
          onChange={(e) => setDraft({ ...draft, shortName: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Theme colour" value={draft.themeColor} onChange={(v) => setDraft({ ...draft, themeColor: v })} />
        <ColorField label="Background colour" value={draft.backgroundColor} onChange={(v) => setDraft({ ...draft, backgroundColor: v })} />
      </div>
      <Input label="App icon URL" hint="Square image, at least 512×512" value={draft.iconUrl}
        onChange={(e) => setDraft({ ...draft, iconUrl: e.target.value })} />
      <Select label="Display mode" value={draft.display} onChange={(e) => setDraft({ ...draft, display: e.target.value as typeof draft.display })}>
        <option value="standalone">Standalone (default)</option>
        <option value="fullscreen">Fullscreen</option>
        <option value="minimal-ui">Minimal UI</option>
        <option value="browser">Browser</option>
      </Select>
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function BookingTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('booking');
  const [newType, setNewType] = useState('');

  return (
    <Card className="space-y-5 p-5">
      <div>
        <p className="field-label">Parcel types</p>
        <div className="flex flex-wrap gap-2">
          {draft.parcelTypes.map((type, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-sm text-primary">
              {type}
              <button type="button" onClick={() => setDraft({ ...draft, parcelTypes: draft.parcelTypes.filter((_, idx) => idx !== i) })}
                className="rounded-full p-0.5 hover:bg-primary/15">
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={newType} placeholder="e.g. Documents" onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newType.trim()) {
                e.preventDefault();
                setDraft({ ...draft, parcelTypes: [...draft.parcelTypes, newType.trim()] });
                setNewType('');
              }
            }} />
          <Button variant="outline" icon={<Plus className="h-4 w-4" />}
            onClick={() => { if (newType.trim()) { setDraft({ ...draft, parcelTypes: [...draft.parcelTypes, newType.trim()] }); setNewType(''); } }}>
            Add
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Max weight (kg)" hint="0 = no limit" type="number" min="0" value={String(draft.maxWeightKg)}
          onChange={(e) => setDraft({ ...draft, maxWeightKg: Number(e.target.value) || 0 })} />
        <Input label="Minimum lead time (hours)" type="number" min="0" value={String(draft.minLeadTimeHours)}
          onChange={(e) => setDraft({ ...draft, minLeadTimeHours: Number(e.target.value) || 0 })} />
        <Input label="Max days in advance" type="number" min="0" max="90" value={String(draft.maxAdvanceDays)}
          onChange={(e) => setDraft({ ...draft, maxAdvanceDays: Number(e.target.value) || 0 })} />
      </div>
      <Checkbox label="Require receiver phone number" checked={draft.requireReceiverPhone}
        onChange={(e) => setDraft({ ...draft, requireReceiverPhone: e.target.checked })} />
      <Textarea label="Message when pricing is unavailable" value={draft.unavailableMessage}
        onChange={(e) => setDraft({ ...draft, unavailableMessage: e.target.value })} />
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

function PaymentsTab() {
  const { draft, setDraft, saving, dirty, onSave } = useDomainForm('payments');
  return (
    <Card className="space-y-4 p-5">
      <Switch label="Accept online (UPI) payment" checked={draft.onlineEnabled} onChange={(v) => setDraft({ ...draft, onlineEnabled: v })} />
      {draft.onlineEnabled && (
        <div className="grid gap-4 rounded-card bg-canvas p-4 sm:grid-cols-2">
          <Input label="UPI ID" value={draft.upiId} onChange={(e) => setDraft({ ...draft, upiId: e.target.value })} />
          <Input label="UPI display name" value={draft.upiDisplayName} onChange={(e) => setDraft({ ...draft, upiDisplayName: e.target.value })} />
          <Input label="QR code image URL" className="sm:col-span-2" value={draft.qrImageUrl}
            onChange={(e) => setDraft({ ...draft, qrImageUrl: e.target.value })} />
        </div>
      )}
      <Switch label="Accept cash" checked={draft.cashEnabled} onChange={(v) => setDraft({ ...draft, cashEnabled: v })} />
      <Switch label="Allow pay later" description="For trusted or business customers" checked={draft.payLaterEnabled}
        onChange={(v) => setDraft({ ...draft, payLaterEnabled: v })} />
      <Switch label="Payment gateway" description="Not connected in this build" checked={draft.gatewayEnabled}
        onChange={(v) => setDraft({ ...draft, gatewayEnabled: v })} />
      <Textarea label="Payment instructions" hint="Shown to customers at checkout" value={draft.instructions}
        onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
      <SaveBar onSave={onSave} saving={saving} dirty={dirty} />
    </Card>
  );
}

/* ==================================================================== */

const TABS = [
  { key: 'brand', label: 'Brand' },
  { key: 'contact', label: 'Contact' },
  { key: 'social', label: 'Social' },
  { key: 'theme', label: 'Theme' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'header', label: 'Header' },
  { key: 'footer', label: 'Footer' },
  { key: 'seo', label: 'SEO' },
  { key: 'pwa', label: 'App (PWA)' },
  { key: 'booking', label: 'Booking' },
  { key: 'payments', label: 'Payments' },
];

export default function Settings() {
  const [tab, setTab] = useState('brand');

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Settings" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title="Settings" description="The single source every page on the site reads from." />
      <Tabs items={TABS} active={tab} onChange={setTab} />
      {tab === 'brand' && <BrandTab />}
      {tab === 'contact' && <ContactTab />}
      {tab === 'social' && <SocialTab />}
      {tab === 'theme' && <ThemeTab />}
      {tab === 'navigation' && <NavigationTab />}
      {tab === 'header' && <HeaderTab />}
      {tab === 'footer' && <FooterTab />}
      {tab === 'seo' && <SeoTab />}
      {tab === 'pwa' && <PwaTab />}
      {tab === 'booking' && <BookingTab />}
      {tab === 'payments' && <PaymentsTab />}
    </div>
  );
}
