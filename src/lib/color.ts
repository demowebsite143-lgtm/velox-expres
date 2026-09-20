/**
 * Hex to RGB channels, e.g. '#0A1F44' -> '10 31 68'.
 *
 * Tailwind reads the channel form through rgb(var(--x) / <alpha-value>),
 * which is what makes admin-set colours work with opacity utilities
 * like bg-primary/10 without a rebuild.
 */
export function hexToChannels(hex: string): string | null {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Relative luminance, for picking readable text over a brand colour. */
export function luminance(hex: string): number {
  const channels = hexToChannels(hex);
  if (!channels) return 0;
  const [r, g, b] = channels.split(' ').map((v) => {
    const s = Number(v) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableTextOn(hex: string): '#FFFFFF' | '#0F1A2D' {
  return luminance(hex) > 0.5 ? '#0F1A2D' : '#FFFFFF';
}
