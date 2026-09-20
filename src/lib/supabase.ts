import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * True only when both public env vars are present. The app is built to
 * run without them: every screen renders, and data-backed areas show a
 * "not connected" state instead of inventing rows to display.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export class NotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not connected. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.',
    );
    this.name = 'NotConfiguredError';
  }
}

/** Use at the top of every service call that needs the database. */
export function requireClient(): SupabaseClient {
  if (!supabase) throw new NotConfiguredError();
  return supabase;
}

/** Base URL for Edge Functions, derived from the project URL. */
export function functionsUrl(name: string): string {
  if (!url) throw new NotConfiguredError();
  return `${url.replace(/\/$/, '')}/functions/v1/${name}`;
}

/** POST to an Edge Function with the anon key attached. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!url || !anonKey) throw new NotConfiguredError();
  const res = await fetch(functionsUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error ?? `Request failed (${res.status})`);
  }
  return payload as T;
}
