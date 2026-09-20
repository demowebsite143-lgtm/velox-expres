import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Tag,
  Timer,
} from 'lucide-react';
import { useSettings } from '@/providers/SettingsProvider';
import {
  useBanners,
  useContentSections,
  useFaqs,
  useOffers,
  useServices,
} from '@/hooks/useCatalog';
import { Section } from '@/components/public/Section';
import { Badge, Button, Card, RouteRule } from '@/components/ui';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import { money, shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Banner, ContentSection } from '@/types/database';

function useSectionMap(page: string) {
  const { data, isLoading } = useContentSections(page);
  const map = new Map<string, ContentSection>(
    (data ?? []).map((s) => [s.section_key, s]),
  );
  return { map, isLoading };
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const current = banners[index];
  const autoSlide = banners.length > 1 && banners.every((b) => b.auto_slide);

  useEffect(() => {
    if (!autoSlide) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [autoSlide, banners.length]);

  if (!current) return null;

  return (
    <div className="relative overflow-hidden bg-primary">
      {current.image_desktop && (
        <picture>
          {current.image_mobile && (
            <source media="(max-width: 640px)" srcSet={current.image_mobile} />
          )}
          <img
            src={current.image_desktop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        </picture>
      )}

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-2xl">
          {current.subtitle && (
            <p className="mb-3 text-sm font-medium text-accent">{current.subtitle}</p>
          )}
          <h1 className="text-display sm:text-display-lg text-white">{current.title}</h1>
          {current.description && (
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-white/85">
              {current.description}
            </p>
          )}
          {current.button_text && current.button_link && (
            <Link to={current.button_link} className="mt-7 inline-block">
              <Button variant="accent" size="lg">
                {current.button_text}
              </Button>
            </Link>
          )}
        </div>

        {banners.length > 1 && (
          <div className="mt-10 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-accent hover:text-accent"
              aria-label="Previous banner"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1.5" role="tablist">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Banner ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-7 bg-accent' : 'w-1.5 bg-white/35',
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % banners.length)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-accent hover:text-accent"
              aria-label="Next banner"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <RouteRule />
    </div>
  );
}

/**
 * Shown when no banner is configured. Not a placeholder — a real hero
 * built from the CMS hero section, with the two actions a visitor came
 * for. A courier site's most characteristic moment is a parcel being
 * looked up, so tracking is inline rather than a link.
 */
function FallbackHero({ section }: { section: ContentSection | undefined }) {
  const { settings, brandName } = useSettings();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const headline = section?.title || brandName;
  const tagline = section?.subtitle || settings.brand.tagline;

  function onTrack(e: FormEvent) {
    e.preventDefault();
    if (code.trim()) navigate(`/track?order=${encodeURIComponent(code.trim())}`);
  }

  return (
    <div className="relative overflow-hidden bg-primary">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, rgb(var(--color-accent)) 0 2px, transparent 2px 28px)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-3xl">
          {tagline && <p className="mb-3 text-sm font-medium text-accent">{tagline}</p>}
          <h1 className="text-display sm:text-display-lg text-white">{headline}</h1>
          {section?.description && (
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-white/85">
              {section.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/book">
              <Button variant="accent" size="lg">
                {settings.navigation.ctaLabel || 'Book a pickup'}
              </Button>
            </Link>
            <Link to="/rate-calculator">
              <Button
                size="lg"
                className="border border-white/25 bg-transparent text-white hover:bg-white/10"
              >
                Check a price
              </Button>
            </Link>
          </div>

          <form onSubmit={onTrack} className="mt-10 max-w-md">
            <label htmlFor="hero-track" className="mb-2 block text-sm text-white/70">
              Already sent something?
            </label>
            <div className="flex gap-2">
              <input
                id="hero-track"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter your order ID"
                className="h-12 flex-1 rounded-card border border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <Button type="submit" variant="accent" size="lg" icon={<Search className="h-4 w-4" />}>
                <span className="hidden sm:inline">Track</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
      <RouteRule />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const HOW_IT_WORKS = [
  { title: 'Book a pickup', body: 'Tell us where to collect from and where it is going.' },
  { title: 'We collect', body: 'A rider picks the parcel up in the window you chose.' },
  { title: 'On the way', body: 'Track each step from your order ID.' },
  { title: 'Delivered', body: 'The receiver confirms with the OTP from your confirmation.' },
];

export default function Home() {
  const { settings, brandName, whatsappHref, callHref } = useSettings();
  const { map, isLoading: sectionsLoading } = useSectionMap('home');
  const banners = useBanners();
  const services = useServices();
  const offers = useOffers();
  const faqs = useFaqs();

  const activeBanners = banners.data ?? [];
  const heroSection = map.get('hero');

  const visible = (key: string) => map.has(key);

  return (
    <>
      {banners.isLoading ? (
        <div className="h-72 bg-primary sm:h-96" aria-busy="true" />
      ) : activeBanners.length > 0 ? (
        <BannerCarousel banners={activeBanners} />
      ) : (
        <FallbackHero section={heroSection} />
      )}

      {/* Trust row — the three positioning words, as claims about the
          service rather than invented statistics. */}
      {visible('trust') && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3">
            {[
              { icon: Timer, label: 'Fast', body: 'Same-area parcels moved the same day.' },
              { icon: ShieldCheck, label: 'Safe', body: 'Handled carefully, confirmed with an OTP.' },
              { icon: Package, label: 'Reliable', body: 'Every status change is recorded and visible.' },
            ].map(({ icon: Icon, label, body }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-accent/20 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visible('how_it_works') && (
        <Section
          title={map.get('how_it_works')?.title}
          description={map.get('how_it_works')?.description}
          tone="muted"
        >
          {/* Numbered because this genuinely is a sequence. */}
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="font-mono text-sm text-accent-dark">{i + 1}</span>
                <h3 className="mt-1 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {visible('services') && (
        <Section title={map.get('services')?.title} description={map.get('services')?.description}>
          {services.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (services.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title="No services listed yet"
                description={`Services appear here once they are added in the admin panel.${
                  settings.contact.phone ? ' In the meantime, call us and we will help.' : ''
                }`}
                action={
                  settings.contact.phone ? (
                    <a href={callHref}>
                      <Button variant="outline" icon={<Phone className="h-4 w-4" />}>
                        Call {brandName}
                      </Button>
                    </a>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(services.data ?? []).map((service) => (
                <Card key={service.id} className="overflow-hidden">
                  {service.image_url && (
                    <img
                      src={service.image_url}
                      alt=""
                      className="h-36 w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-ink">{service.name}</h3>
                    {service.description && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                        {service.description}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {visible('calculator') && (
        <Section tone="muted">
          <Card className="overflow-hidden">
            <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-display-sm">{map.get('calculator')?.title}</h2>
                {map.get('calculator')?.subtitle && (
                  <p className="mt-2 text-base text-ink-muted">
                    {map.get('calculator')?.subtitle}
                  </p>
                )}
              </div>
              <Link to="/rate-calculator">
                <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                  Open the calculator
                </Button>
              </Link>
            </div>
          </Card>
        </Section>
      )}

      {visible('offers') && (
        <Section title={map.get('offers')?.title}>
          {offers.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (offers.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<Tag className="h-6 w-6" />}
                title="No offers running right now"
                description="When an offer is live it will show up here."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(offers.data ?? []).slice(0, 3).map((offer) => (
                <Card key={offer.id} className="border-accent/40 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">{offer.name}</h3>
                    <Badge tone="accent">
                      {offer.discount_type === 'percentage'
                        ? `${offer.discount_value}% off`
                        : `${money(offer.discount_value)} off`}
                    </Badge>
                  </div>
                  {offer.description && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {offer.description}
                    </p>
                  )}
                  <dl className="mt-4 space-y-1 text-sm text-ink-muted">
                    {offer.min_order_value > 0 && (
                      <div>Minimum order {money(offer.min_order_value)}</div>
                    )}
                    {offer.ends_at && <div>Ends {shortDate(offer.ends_at)}</div>}
                    {offer.code && (
                      <div>
                        Code <span className="font-mono text-ink">{offer.code}</span>
                      </div>
                    )}
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {visible('business') && (
        <Section tone="primary">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <div className="max-w-prose">
              <h2 className="text-display-sm text-white">{map.get('business')?.title}</h2>
              {map.get('business')?.subtitle && (
                <p className="mt-3 text-base leading-relaxed text-white/80">
                  {map.get('business')?.subtitle}
                </p>
              )}
            </div>
            <Link to="/business">
              <Button variant="accent" size="lg">
                Business accounts
              </Button>
            </Link>
          </div>
        </Section>
      )}

      {visible('faq') && (faqs.data ?? []).length > 0 && (
        <Section title={map.get('faq')?.title} tone="muted">
          <div className="max-w-prose divide-y divide-line">
            {(faqs.data ?? []).slice(0, 5).map((faq) => (
              <details key={faq.id} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-ink">
                  {faq.question}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
          <Link to="/faq" className="mt-6 inline-block">
            <Button variant="outline">All questions</Button>
          </Link>
        </Section>
      )}

      {visible('contact_cta') && (
        <Section>
          <Card className="p-6 text-center sm:p-10">
            <h2 className="text-display-sm">{map.get('contact_cta')?.title}</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/book">
                <Button variant="accent" size="lg">
                  {settings.navigation.ctaLabel || 'Book a pickup'}
                </Button>
              </Link>
              {settings.contact.whatsapp && (
                <a href={whatsappHref()} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="lg" icon={<MessageCircle className="h-4 w-4" />}>
                    Message us
                  </Button>
                </a>
              )}
            </div>
          </Card>
        </Section>
      )}

      {sectionsLoading && (
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SkeletonCard />
        </div>
      )}
    </>
  );
}
