import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultSettings, type SettingsKey, type SettingsShape } from '@/schemas/settings';
import {
  loadSettings,
  readCachedSettings,
  saveSetting,
  formattedAddress,
} from '@/services/settingsService';
import { hexToChannels } from '@/lib/color';
import { telLink, whatsappLink } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * The configuration spine.
 *
 * Every business value in the application is read from here. No
 * component contains a phone number, a brand name, a colour or an
 * address. Changing any of them in Admin → Settings changes the whole
 * site with no deploy.
 */

interface SettingsContextValue {
  settings: SettingsShape;
  loading: boolean;
  error: Error | null;
  /** False when running on defaults (no credentials, or fetch failed). */
  live: boolean;
  issues: string[];
  refresh: () => Promise<void>;
  save: <K extends SettingsKey>(key: K, value: SettingsShape[K]) => Promise<void>;

  // Derived conveniences, so components never rebuild these by hand.
  brandName: string;
  addressLine: string;
  callHref: string;
  whatsappHref: (message?: string) => string;
  hasContactPhone: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Write brand colours to CSS custom properties as RGB channels.
 * Tailwind consumes them through rgb(var(--x) / <alpha-value>), which is
 * what lets an admin colour change take effect without a rebuild and
 * still work with opacity utilities like bg-primary/10.
 */
function applyTheme(theme: SettingsShape['theme']) {
  const root = document.documentElement;
  const map: Record<string, string> = {
    '--color-primary': theme.primary,
    '--color-primary-dark': theme.primaryDark,
    '--color-primary-light': theme.primaryLight,
    '--color-accent': theme.accent,
    '--color-accent-dark': theme.accentDark,
    '--color-secondary': theme.secondary,
    '--color-bg': theme.background,
    '--color-surface': theme.surface,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-border': theme.border,
  };

  for (const [property, hex] of Object.entries(map)) {
    const channels = hexToChannels(hex);
    if (channels) root.style.setProperty(property, channels);
  }
  root.style.setProperty('--radius-button', `${theme.buttonRadius}px`);
}

/** Document head values are configuration too, not constants in index.html. */
function applyDocumentMeta(settings: SettingsShape) {
  const { seo, brand, pwa } = settings;

  document.title = seo.title || brand.browserTitle || brand.websiteName || 'Courier service';

  const description = document.getElementById('meta-description');
  if (description) description.setAttribute('content', seo.metaDescription);

  const themeColor = document.getElementById('meta-theme-color');
  if (themeColor) themeColor.setAttribute('content', pwa.themeColor);

  if (brand.faviconUrl) {
    const favicon = document.getElementById('app-favicon');
    if (favicon) favicon.setAttribute('href', brand.faviconUrl);
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start from the cached copy so the first paint is already branded.
  const [settings, setSettings] = useState<SettingsShape>(
    () => readCachedSettings() ?? defaultSettings(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [live, setLive] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadSettings();
      setSettings(result.settings);
      setIssues(result.issues);
      setLive(result.live);
    } catch (err) {
      // Keep whatever we already have on screen; a settings fetch
      // failure must not blank the site.
      setError(err instanceof Error ? err : new Error('Could not load settings'));
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    applyTheme(settings.theme);
    applyDocumentMeta(settings);
  }, [settings]);

  const save = useCallback(
    async <K extends SettingsKey>(key: K, value: SettingsShape[K]) => {
      const saved = await saveSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: saved }));
    },
    [],
  );

  const value = useMemo<SettingsContextValue>(() => {
    const { contact, brand } = settings;
    return {
      settings,
      loading,
      error,
      live: live && isSupabaseConfigured,
      issues,
      refresh,
      save,
      brandName: brand.brandName || brand.websiteName || contact.businessName || '',
      addressLine: formattedAddress(contact),
      callHref: contact.phone ? telLink(contact.phone, contact.countryCode) : '',
      whatsappHref: (message?: string) =>
        contact.whatsapp ? whatsappLink(contact.whatsapp, contact.countryCode, message) : '',
      hasContactPhone: Boolean(contact.phone || contact.whatsapp),
    };
  }, [settings, loading, error, live, issues, refresh, save]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** Shorthand for the common case of reading one domain. */
export function useSettingsDomain<K extends SettingsKey>(key: K): SettingsShape[K] {
  return useSettings().settings[key];
}
