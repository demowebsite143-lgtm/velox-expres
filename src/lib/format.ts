import { format, parseISO, isValid } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return inr.format(value);
}

export function moneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.abs(value) >= 100000 ? inrCompact.format(value) : inr.format(value);
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function weight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '—';
  return kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg} kg`;
}

export function distance(km: number | null | undefined): string {
  if (km === null || km === undefined) return '—';
  return `${km} km`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function shortDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy') : '—';
}

export function dateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy, h:mm a') : '—';
}

export function timeOnly(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'h:mm a') : '—';
}

/** '14:30:00' from a Postgres time column becomes '2:30 PM'. */
export function clockTime(value: string | null | undefined): string {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return '—';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

export function isoDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
