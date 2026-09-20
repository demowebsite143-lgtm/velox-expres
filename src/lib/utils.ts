import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip everything except digits — phone comparison is done on digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Build a wa.me link. Country code is configurable because the number
 * format is business configuration, not a constant.
 */
export function whatsappLink(
  phone: string,
  countryCode: string,
  message?: string,
): string {
  const digits = digitsOnly(phone);
  const cc = digitsOnly(countryCode) || '91';
  const full = digits.length > 10 ? digits : `${cc}${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${full}${text}`;
}

export function telLink(phone: string, countryCode = '91'): string {
  const digits = digitsOnly(phone);
  if (!digits) return '#';
  return digits.length > 10 ? `tel:+${digits}` : `tel:+${digitsOnly(countryCode)}${digits}`;
}

export function mapsDirectionsLink(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function sortByOrder<T extends { display_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.display_order - b.display_order);
}

export function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

/** Copy helper that reports success so the UI can show the right toast. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
