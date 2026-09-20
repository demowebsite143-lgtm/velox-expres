import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AdminUser } from '@/types/database';

/**
 * Admin-only authentication.
 *
 * Customers never sign in — booking is anonymous and tracking is by
 * Order ID plus phone. Riders never sign in either; they work from a
 * per-order token link. So this provider guards exactly one surface:
 * /admin.
 *
 * Being in auth.users is not enough. The session is only treated as
 * admin when a matching active row exists in the admins table, which is
 * the same check is_admin() performs inside the database.
 */

interface AuthContextValue {
  session: Session | null;
  admin: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = useCallback(async (current: Session | null) => {
    if (!current || !supabase) {
      setAdmin(null);
      return;
    }
    const { data } = await supabase
      .from('admins')
      .select('*')
      .eq('id', current.user.id)
      .eq('is_active', true)
      .maybeSingle();
    setAdmin((data as AdminUser) ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadAdmin(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      await loadAdmin(next);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not connected. Add your project credentials to .env.local.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('That email and password combination did not work.');

    const { data: adminRow } = await supabase
      .from('admins')
      .select('*')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminRow) {
      await supabase.auth.signOut();
      throw new Error('This account does not have admin access.');
    }
    setAdmin(adminRow as AdminUser);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAdmin(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      admin,
      loading,
      isAdmin: Boolean(session && admin),
      signIn,
      signOut,
      configured: isSupabaseConfigured,
    }),
    [session, admin, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
