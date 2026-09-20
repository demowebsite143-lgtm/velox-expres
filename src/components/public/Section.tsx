import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Page section shell. Titles come from the CMS, so a section with no
 * configured title simply renders its content without a heading rather
 * than showing an empty heading slot.
 */
export function Section({
  title,
  subtitle,
  description,
  children,
  className,
  tone = 'default',
  id,
}: {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  children?: ReactNode;
  className?: string;
  tone?: 'default' | 'muted' | 'primary';
  id?: string;
}) {
  const tones = {
    default: 'bg-canvas',
    muted: 'bg-surface',
    primary: 'bg-primary text-white',
  };

  return (
    <section id={id} className={cn('py-12 sm:py-16', tones[tone], className)}>
      <div className="mx-auto max-w-6xl px-4">
        {(title || subtitle || description) && (
          <header className="mb-8 max-w-prose">
            {subtitle && (
              <p
                className={cn(
                  'mb-2 text-sm font-medium',
                  tone === 'primary' ? 'text-accent' : 'text-primary',
                )}
              >
                {subtitle}
              </p>
            )}
            {title && (
              <h2
                className={cn(
                  'text-display-sm sm:text-display',
                  tone === 'primary' && 'text-white',
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className={cn(
                  'mt-3 text-base leading-relaxed',
                  tone === 'primary' ? 'text-white/80' : 'text-ink-muted',
                )}
              >
                {description}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <h1 className="text-display-sm sm:text-display">{title}</h1>
        {description && (
          <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
