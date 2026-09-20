import { Link } from 'react-router-dom';
import {
  Boxes, ChevronRight, Mail, MapPin, MessageCircle, Phone, ShieldAlert, Tag,
} from 'lucide-react';
import { PageHeader, Section } from '@/components/public/Section';
import { Badge, Button, Card } from '@/components/ui';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import {
  DAY_NAMES, useContentSections, useFaqs, useOffers, useSafetyRules,
  useServiceAreas, useServices, useWorkingHours,
} from '@/hooks/useCatalog';
import { useSettings } from '@/providers/SettingsProvider';
import { clockTime, money, shortDate } from '@/lib/format';

/** Renders whichever intro section the CMS holds for a page. */
function CmsIntro({ page, fallbackTitle }: { page: string; fallbackTitle: string }) {
  const { data } = useContentSections(page);
  const intro = data?.find((s) => s.section_key === 'intro');
  return (
    <PageHeader
      title={intro?.title || fallbackTitle}
      description={intro?.description || intro?.subtitle}
    />
  );
}

/** Long-form CMS body, shown when the owner has written one. */
function CmsBody({ page }: { page: string }) {
  const { data, isLoading } = useContentSections(page);
  const sections = (data ?? []).filter((s) => s.section_key !== 'intro' || s.description);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SkeletonCard />
      </div>
    );
  }
  if (sections.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card>
          <EmptyState
            title="This page has not been written yet"
            description="Content for this page is added in Admin → Website content."
          />
        </Card>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-prose px-4 py-10">
      {sections.map((s) => (
        <article key={s.id} className="mb-8 last:mb-0">
          {s.section_key !== 'intro' && s.title && (
            <h2 className="mb-3 text-xl font-semibold text-ink">{s.title}</h2>
          )}
          {s.description && (
            <p className="whitespace-pre-line text-base leading-relaxed text-ink-muted">
              {s.description}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

export function ServicesPage() {
  const services = useServices();
  return (
    <>
      <CmsIntro page="services" fallbackTitle="Services" />
      <Section>
        {services.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (services.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<Boxes className="h-6 w-6" />}
              title="No services listed yet"
              description="Services appear here once they are added in the admin panel."
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(services.data ?? []).map((s) => (
              <Card key={s.id} className="overflow-hidden">
                {s.image_url && (
                  <img src={s.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
                )}
                <div className="p-5">
                  <h2 className="text-base font-semibold text-ink">{s.name}</h2>
                  {s.description && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.description}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

export function OffersPage() {
  const offers = useOffers();
  return (
    <>
      <PageHeader title="Offers" description="Discounts currently running." />
      <Section>
        {offers.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
        ) : (offers.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<Tag className="h-6 w-6" />}
              title="No offers running right now"
              description="When an offer goes live it will be listed here."
              action={<Link to="/book"><Button variant="outline">Book a pickup</Button></Link>}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(offers.data ?? []).map((offer) => (
              <Card key={offer.id} className="border-accent/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink">{offer.name}</h2>
                  <Badge tone="accent">
                    {offer.discount_type === 'percentage'
                      ? `${offer.discount_value}% off`
                      : `${money(offer.discount_value)} off`}
                  </Badge>
                </div>
                {offer.description && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{offer.description}</p>
                )}
                <dl className="mt-4 space-y-1 text-sm text-ink-muted">
                  {offer.min_order_value > 0 && <div>Minimum order {money(offer.min_order_value)}</div>}
                  {offer.max_discount && <div>Maximum discount {money(offer.max_discount)}</div>}
                  {offer.ends_at && <div>Ends {shortDate(offer.ends_at)}</div>}
                  {offer.code && <div>Code <span className="font-mono text-ink">{offer.code}</span></div>}
                </dl>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

export function FaqPage() {
  const faqs = useFaqs();
  const grouped = new Map<string, typeof faqs.data>();
  for (const faq of faqs.data ?? []) {
    const key = faq.category || 'General';
    grouped.set(key, [...(grouped.get(key) ?? []), faq]);
  }

  return (
    <>
      <PageHeader title="Questions" description="If yours is not here, call or message us." />
      <Section>
        {faqs.isLoading ? (
          <SkeletonCard />
        ) : (faqs.data ?? []).length === 0 ? (
          <Card>
            <EmptyState title="No questions published yet"
              description="FAQs are added in Admin → FAQ." />
          </Card>
        ) : (
          <div className="max-w-prose space-y-8">
            {[...grouped.entries()].map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-2 text-sm font-semibold text-primary">{category}</h2>
                <div className="divide-y divide-line">
                  {(items ?? []).map((faq) => (
                    <details key={faq.id} className="group py-4">
                      <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-ink">
                        {faq.question}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                        {faq.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

export function SafetyPage() {
  const rules = useSafetyRules();
  const grouped = new Map<string, typeof rules.data>();
  for (const rule of rules.data ?? []) {
    grouped.set(rule.category, [...(grouped.get(rule.category) ?? []), rule]);
  }

  return (
    <>
      <CmsIntro page="safety" fallbackTitle="Safety & rules" />
      <Section>
        {rules.isLoading ? (
          <SkeletonCard />
        ) : (rules.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<ShieldAlert className="h-6 w-6" />}
              title="Safety rules have not been published yet"
              description="Prohibited items, packing requirements and cancellation terms are added in Admin → Safety & rules."
            />
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {[...grouped.entries()].map(([category, items]) => (
              <Card key={category} className="p-5">
                <h2 className="text-base font-semibold capitalize text-ink">
                  {category.replace(/_/g, ' ')}
                </h2>
                <ul className="mt-3 space-y-3">
                  {(items ?? []).map((rule) => (
                    <li key={rule.id}>
                      <p className="text-sm font-medium text-ink">{rule.title}</p>
                      {rule.description && (
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                          {rule.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

export function ContactPage() {
  const { settings, addressLine, callHref, whatsappHref, brandName } = useSettings();
  const { contact } = settings;
  const hours = useWorkingHours();
  const areas = useServiceAreas();

  return (
    <>
      <CmsIntro page="contact" fallbackTitle="Contact" />
      <Section>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">Reach {brandName || 'us'}</h2>
            <ul className="mt-4 space-y-4 text-sm">
              {contact.phone && (
                <li>
                  <a href={callHref} className="flex items-start gap-3 text-ink hover:text-primary">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <span><span className="block text-ink-muted">Phone</span>{contact.phone}</span>
                  </a>
                </li>
              )}
              {contact.whatsapp && (
                <li>
                  <a href={whatsappHref()} target="_blank" rel="noreferrer"
                     className="flex items-start gap-3 text-ink hover:text-primary">
                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <span><span className="block text-ink-muted">WhatsApp</span>{contact.whatsapp}</span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="flex items-start gap-3 text-ink hover:text-primary">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <span><span className="block text-ink-muted">Email</span>{contact.email}</span>
                  </a>
                </li>
              )}
              {addressLine && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                  <span><span className="block text-ink-muted">Address</span>{addressLine}</span>
                </li>
              )}
            </ul>
            {contact.mapsUrl && (
              <a href={contact.mapsUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block">
                <Button variant="outline">Open in Maps</Button>
              </a>
            )}
          </Card>

          <div className="grid gap-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-semibold text-ink">Opening hours</h2>
              {hours.isLoading ? (
                <SkeletonCard className="mt-4 border-0 shadow-none" />
              ) : (hours.data ?? []).every((d) => !d.opens_at) ? (
                <p className="mt-3 text-sm text-ink-muted">
                  Hours have not been set yet.
                  {contact.phone && ' Call us and we will tell you when we are open.'}
                </p>
              ) : (
                <dl className="mt-4 space-y-2 text-sm">
                  {(hours.data ?? []).map((day) => (
                    <div key={day.day_of_week} className="flex justify-between gap-4">
                      <dt className="text-ink-muted">{DAY_NAMES[day.day_of_week]}</dt>
                      <dd className="text-ink">
                        {!day.is_open
                          ? 'Closed'
                          : day.opens_at && day.closes_at
                            ? `${clockTime(day.opens_at)} – ${clockTime(day.closes_at)}`
                            : 'Open'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-semibold text-ink">Areas we cover</h2>
              {(areas.data ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">
                  Service areas have not been added yet.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(areas.data ?? []).map((a) => (
                    <Badge key={a.id} tone="primary">{a.name}</Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}

export function AboutPage() {
  return (<><CmsIntro page="about" fallbackTitle="About" /><CmsBody page="about" /></>);
}

export function BusinessPage() {
  const { settings, whatsappHref, callHref } = useSettings();
  return (
    <>
      <CmsIntro page="business" fallbackTitle="Business accounts" />
      <CmsBody page="business" />
      <Section tone="muted">
        <Card className="p-6 text-center sm:p-10">
          <h2 className="text-xl font-semibold text-ink">Talk to us about a business account</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            Agreed rates, monthly billing and regular pickups are arranged directly.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {settings.contact.phone && (
              <a href={callHref}>
                <Button icon={<Phone className="h-4 w-4" />}>Call us</Button>
              </a>
            )}
            {settings.contact.whatsapp && (
              <a href={whatsappHref()} target="_blank" rel="noreferrer">
                <Button variant="outline" icon={<MessageCircle className="h-4 w-4" />}>
                  Message on WhatsApp
                </Button>
              </a>
            )}
          </div>
        </Card>
      </Section>
    </>
  );
}

export function LegalPageView({ page }: { page: 'privacy' | 'terms' }) {
  const title = page === 'privacy' ? 'Privacy policy' : 'Terms & conditions';
  return (<><CmsIntro page={page} fallbackTitle={title} /><CmsBody page={page} /></>);
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-sm text-accent-dark">404</p>
      <h1 className="mt-2 text-display-sm">This page does not exist</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-muted">
        The link may be out of date. Everything else is still where you left it.
      </p>
      <Link to="/" className="mt-7"><Button size="lg">Back to the homepage</Button></Link>
    </div>
  );
}
