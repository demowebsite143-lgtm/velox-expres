import { useEffect, useState } from 'react';

/**
 * Recharts renders plain SVG attributes, so rather than trust every
 * browser to resolve `var(--color-primary)` inside an SVG fill/stroke,
 * this reads the actual computed values once and hands charts concrete
 * `rgb(...)` strings. Colors still come from the live theme — set by
 * SettingsProvider from the admin theme settings — they just get
 * resolved to a literal string before reaching an SVG attribute.
 */

export interface ChartColors {
  primary: string;
  primaryLight: string;
  accent: string;
  accentDark: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  muted: string;
  grid: string;
}

const FALLBACK: ChartColors = {
  primary: 'rgb(10, 31, 68)',
  primaryLight: 'rgb(26, 58, 112)',
  accent: 'rgb(255, 196, 46)',
  accentDark: 'rgb(224, 166, 22)',
  success: 'rgb(22, 143, 90)',
  warning: 'rgb(201, 138, 8)',
  danger: 'rgb(199, 46, 46)',
  info: 'rgb(30, 105, 194)',
  muted: 'rgb(100, 114, 138)',
  grid: 'rgb(224, 229, 238)',
};

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  // Custom properties are stored as space-separated RGB channels, e.g. "10 31 68".
  return `rgb(${raw.replace(/\s+/g, ', ')})`;
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    setColors({
      primary: readVar('--color-primary', FALLBACK.primary),
      primaryLight: readVar('--color-primary-light', FALLBACK.primaryLight),
      accent: readVar('--color-accent', FALLBACK.accent),
      accentDark: readVar('--color-accent-dark', FALLBACK.accentDark),
      success: readVar('--color-success', FALLBACK.success),
      warning: readVar('--color-warning', FALLBACK.warning),
      danger: readVar('--color-danger', FALLBACK.danger),
      info: readVar('--color-info', FALLBACK.info),
      muted: readVar('--color-text-muted', FALLBACK.muted),
      grid: readVar('--color-border', FALLBACK.grid),
    });
  }, []);

  return colors;
}
