import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

/**
 * Small shared building blocks used across every admin screen, so each
 * feature page (riders, services, banners, orders, ...) looks and
 * behaves the same without repeating layout code.
 */

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-display-sm">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export interface TabItem {
  key: string;
  label: string;
  badge?: number;
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="hide-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            'relative shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
            active === item.key ? 'text-primary' : 'text-ink-muted hover:text-ink',
          )}
        >
          {item.label}
          {item.badge !== undefined && item.badge > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {item.badge}
            </span>
          )}
          {active === item.key && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Responsive data list: a table on wide screens, stacked cards on
 * narrow ones. Both are driven by the same column definitions, so a
 * screen only writes them once.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Hidden on the mobile card layout — for dense secondary columns. */
  hideOnMobile?: boolean;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  rowActions,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
}) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-3 font-medium', col.className)}>
                  {col.header}
                </th>
              ))}
              {rowActions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && 'cursor-pointer hover:bg-canvas')}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3.5 align-middle', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={cn('p-4', onRowClick && 'cursor-pointer active:bg-canvas')}
          >
            <div className="space-y-1.5">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((col, i) => (
                  <div
                    key={col.key}
                    className={i === 0 ? 'font-medium text-ink' : 'flex justify-between gap-3 text-sm'}
                  >
                    {i === 0 ? (
                      col.render(row)
                    ) : (
                      <>
                        <span className="text-ink-muted">{col.header}</span>
                        <span className="text-right text-ink">{col.render(row)}</span>
                      </>
                    )}
                  </div>
                ))}
            </div>
            {rowActions && (
              <div className="mt-3 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                {rowActions(row)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function ActiveToggleButton({
  isActive,
  onToggle,
  busy,
}: {
  isActive: boolean;
  onToggle: () => void;
  busy?: boolean;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onToggle} disabled={busy}>
      {isActive ? 'Active' : 'Inactive'}
    </Button>
  );
}
