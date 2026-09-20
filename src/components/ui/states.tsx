import type { ReactNode } from 'react';
import { AlertCircle, DatabaseZap, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card } from './index';
import { isSupabaseConfigured, NotConfiguredError } from '@/lib/supabase';

/**
 * Loading, empty and error states.
 *
 * Empty states here never fill space with invented content. When there
 * is no data the screen says there is no data and offers the action
 * that would create some.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={cn('p-5', className)}>
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2">
        <Skeleton />
        <Skeleton className="w-4/5" />
      </div>
    </Card>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 p-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? 'h-4 w-32' : 'h-4 flex-1'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/5 text-primary">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const notConfigured =
    error instanceof NotConfiguredError ||
    (error instanceof Error && error.name === 'NotConfiguredError') ||
    !isSupabaseConfigured;

  if (notConfigured) return <NotConnectedState className={className} />;

  const message =
    error instanceof Error ? error.message : 'Something went wrong loading this.';

  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-ink">This did not load</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Shown wherever data is expected but the project has no credentials.
 * Deliberately explicit: the alternative would be a screen that looks
 * broken, or worse, one filled with sample rows that look real.
 */
export function NotConnectedState({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
        <DatabaseZap className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-ink">Database not connected</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
        Add <code className="rounded bg-canvas px-1 font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-canvas px-1 font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> to
        your <code className="rounded bg-canvas px-1 font-mono text-xs">.env.local</code>, then
        restart the dev server. Setup steps are in the README.
      </p>
    </div>
  );
}

export function OfflineNotice() {
  return (
    <div className="flex items-center gap-2 rounded-card border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
      <WifiOff className="h-4 w-4 shrink-0" />
      You are offline. Some things will not update until the connection is back.
    </div>
  );
}

/** Wraps the three states so pages do not repeat the same branching. */
export function AsyncBoundary<T>({
  loading,
  error,
  data,
  onRetry,
  skeleton,
  empty,
  children,
}: {
  loading: boolean;
  error: unknown;
  data: T | undefined;
  onRetry?: () => void;
  skeleton?: ReactNode;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (loading) return <>{skeleton ?? <SkeletonTable />}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (data === undefined || data === null) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  if (Array.isArray(data) && data.length === 0) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }
  return <>{children(data)}</>;
}
