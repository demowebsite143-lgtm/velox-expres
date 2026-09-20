import { requireClient, isSupabaseConfigured } from '@/lib/supabase';
import {
  SETTINGS_KEYS,
  defaultSettings,
  parseSetting,
  settingsSchemas,
  type SettingsKey,
  type SettingsShape,
} from '@/schemas/settings';

export interface SettingsLoad {
  settings: SettingsShape;
  /** Validation problems, surfaced in the admin panel rather than hidden. */
  issues: string[];
  /** False when Supabase is unset or unreachable — defaults are in use. */
  live: boolean;
}

const CACHE_KEY = 'velox:settings:v1';

/**
 * Read the cached copy first so the first paint is branded. Without
 * this every page flashes default navy before the fetch returns.
 */
export function readCachedSettings(): SettingsShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = defaultSettings();
    for (const key of SETTINGS_KEYS) {
      result[key] = parseSetting(key, parsed[key]).data as never;
    }
    return result;
  } catch {
    return null;
  }
}

function writeCache(settings: SettingsShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    /* private browsing, quota, etc. Cache is an optimisation only. */
  }
}

export async function loadSettings(): Promise<SettingsLoad> {
  if (!isSupabaseConfigured) {
    return { settings: defaultSettings(), issues: [], live: false };
  }

  const client = requireClient();
  const { data, error } = await client.from('settings').select('key, value');
  if (error) throw error;

  const rows = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const settings = defaultSettings();
  const issues: string[] = [];

  for (const key of SETTINGS_KEYS) {
    const row = rows.get(key);
    if (row === undefined) {
      issues.push(`${key}: no settings row found, using defaults`);
      continue;
    }
    const parsed = parseSetting(key, row);
    settings[key] = parsed.data as never;
    issues.push(...parsed.issues);
  }

  writeCache(settings);
  return { settings, issues, live: true };
}

export async function saveSetting<K extends SettingsKey>(
  key: K,
  value: SettingsShape[K],
): Promise<SettingsShape[K]> {
  const client = requireClient();

  // Validate before writing so a malformed shape never reaches the row.
  const parsed = settingsSchemas[key].parse(value);

  const { error } = await client
    .from('settings')
    .upsert({ key, value: parsed, updated_at: new Date().toISOString() });
  if (error) throw error;

  return parsed as SettingsShape[K];
}

/** Full address as one line, skipping the parts that are not filled in. */
export function formattedAddress(contact: SettingsShape['contact']): string {
  return [
    contact.addressLine1,
    contact.addressLine2,
    contact.city,
    contact.state,
    contact.pinCode,
  ]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}
