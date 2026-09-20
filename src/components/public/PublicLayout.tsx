import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, Package, Phone, X, MessageCircle, MapPin, Mail } from 'lucide-react';
import { useSettings } from '@/providers/SettingsProvider';
import { Button, RouteRule } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Site chrome. Every label, link, colour, number and logo here comes
 * from settings — there is no business string in this file.
 */

function BrandMark({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { settings, brandName } = useSettings();
  const { brand } = settings;
  const logo = variant === 'dark' ? brand.footerLogoUrl || brand.logoUrl : brand.logoUrl;

  if (logo) {
    return <img src={logo} alt={brandName} className="h-9 w-auto object-contain" />;
  }

  // No logo uploaded yet: a typographic mark rather than a placeholder
  // image box. Reads as intentional until the owner uploads artwork.
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-[10px]',
          variant === 'dark' ? 'bg-accent text-primary-dark' : 'bg-primary text-accent',
        )}
      >
        <Package className="h-5 w-5" strokeWidth={2.4} />
      </span>
      {brandName && (
        <span
          className={cn(
            'font-display text-lg font-bold leading-none tracking-tight',
            variant === 'dark' ? 'text-white' : 'text-ink',
          )}
          style={{ fontStretch: '115%' }}
        >
          {brandName}
        </span>
      )}
    </span>
  );
}

function Header() {
  const { settings, callHref, whatsappHref } = useSettings();
  const { navigation, header, contact } = settings;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const items = navigation.items
    .filter((i) => i.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {header.showAnnouncement && header.announcementText && (
        <div className="bg-accent text-primary-dark">
          <div className="mx-auto max-w-6xl px-4 py-2 text-center text-sm font-medium">
            {header.announcementLink ? (
              <a href={header.announcementLink} className="underline underline-offset-2">
                {header.announcementText}
              </a>
            ) : (
              header.announcementText
            )}
          </div>
        </div>
      )}

      <header
        className={cn(
          'z-40 border-b border-line bg-surface/95 backdrop-blur',
          header.sticky && 'sticky top-0',
        )}
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="shrink-0" aria-label="Home">
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary/8 text-primary' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {header.showCallButton && contact.phone && (
              <a
                href={callHref}
                className="hidden h-10 w-10 items-center justify-center rounded-card border border-line text-ink-muted transition-colors hover:border-primary/40 hover:text-primary sm:flex"
                aria-label="Call us"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {navigation.ctaLabel && (
              <Button
                variant="accent"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => {
                  window.location.href = navigation.ctaPath || '/book';
                }}
              >
                {navigation.ctaLabel}
              </Button>
            )}
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-card border border-line text-ink lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="animate-slide-up border-t border-line bg-surface lg:hidden">
            <nav className="mx-auto grid max-w-6xl gap-1 px-4 py-3">
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'rounded-card px-3 py-3 text-base font-medium transition-colors',
                      isActive ? 'bg-primary/8 text-primary' : 'text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {contact.phone && (
                  <Button variant="outline" onClick={() => { window.location.href = callHref; }}>
                    <Phone className="h-4 w-4" /> Call
                  </Button>
                )}
                {contact.whatsapp && (
                  <Button variant="outline" onClick={() => window.open(whatsappHref(), '_blank')}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

/**
 * Bottom action bar on phones. Booking and calling are the two things
 * a customer actually came to do, so they stay reachable by thumb.
 */
function StickyActions() {
  const { settings, callHref, whatsappHref } = useSettings();
  const { navigation, header, contact } = settings;
  const location = useLocation();

  // Hide it on the pages that already end in the same action.
  if (['/book', '/track'].includes(location.pathname)) return null;

  const showCall = header.showCallButton && contact.phone;
  const showWhatsapp = header.showWhatsappButton && contact.whatsapp;
  if (!showCall && !showWhatsapp && !navigation.ctaLabel) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur sm:hidden"
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      <div className="flex gap-2">
        {showCall && (
          <a
            href={callHref}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card border border-line text-primary"
            aria-label="Call"
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        {showWhatsapp && (
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card border border-line text-primary"
            aria-label="Message on WhatsApp"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        )}
        {navigation.ctaLabel && (
          <Link to={navigation.ctaPath || '/book'} className="flex-1">
            <Button variant="accent" size="lg" fullWidth>
              {navigation.ctaLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function Footer() {
  const { settings, brandName, addressLine, callHref } = useSettings();
  const { footer, contact, social, brand } = settings;

  const socialLinks = Object.entries(social).filter(([, url]) => url);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-primary text-white/80">
      <RouteRule />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <BrandMark variant="dark" />
            {(footer.description || brand.brandDescription) && (
              <p className="mt-4 max-w-xs text-sm leading-relaxed">
                {footer.description || brand.brandDescription}
              </p>
            )}
            {socialLinks.length > 0 && footer.showSocial && (
              <div className="mt-5 flex gap-2">
                {socialLinks.map(([name, url]) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-card border border-white/15 px-3 py-1.5 text-xs capitalize transition-colors hover:border-accent hover:text-accent"
                  >
                    {name}
                  </a>
                ))}
              </div>
            )}
          </div>

          {footer.sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-sm transition-colors hover:text-accent">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-sm font-semibold text-white">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {contact.phone && (
                <li>
                  <a href={callHref} className="flex items-start gap-2 hover:text-accent">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="flex items-start gap-2 hover:text-accent">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                    {contact.email}
                  </a>
                </li>
              )}
              {addressLine && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{addressLine}</span>
                </li>
              )}
              {contact.proprietor && (
                <li className="pt-1 text-white/60">Proprietor: {contact.proprietor}</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-white/60">
          {footer.copyright || `© ${year} ${brandName || 'All rights reserved'}`}
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-20 sm:pb-0">
        <Outlet />
      </main>
      <StickyActions />
      <Footer />
    </div>
  );
}
