import { Suspense, lazy, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bike,
  Boxes,
  Briefcase,
  ClipboardList,
  CreditCard,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { Button, Card, Input, Spinner } from '@/components/ui';
import { EmptyState, ErrorState, NotConnectedState, SkeletonCard } from '@/components/ui/states';
import { getSummary, rangeFor, isEmptySummary } from '@/services/analyticsService';
import { listOrders } from '@/services/orderService';
import { OrderStatusBadge } from '@/components/ui/OrderStatus';
import { isSupabaseConfigured } from '@/lib/supabase';
import { money, count as fmtCount, shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Admin area.
 *
 * Gated on an active row in the admins table, not merely on having a
 * Supabase account — the same condition is_admin() enforces inside the
 * database, so the UI gate and the data gate cannot drift apart.
 *
 * Feature screens are lazy-loaded so signing in doesn't pull the whole
 * admin panel (charts, every CRUD form) into one bundle up front.
 */

const Orders = lazy(() => import('./Orders'));
const OrderDetail = lazy(() => import('./OrderDetail'));
const Riders = lazy(() => import('./Riders'));
const PricingAreas = lazy(() => import('./PricingAreas'));
const Catalogue = lazy(() => import('./Catalogue'));
const Payments = lazy(() => import('./Payments'));
const Expenses = lazy(() => import('./Expenses'));
const Media = lazy(() => import('./Media'));
const Settings = lazy(() => import('./Settings'));
const Analytics = lazy(() => import('./Analytics'));
const BusinessCustomers = lazy(() => import('./BusinessCustomers'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/riders', label: 'Riders', icon: Bike },
  { to: '/admin/pricing', label: 'Pricing & areas', icon: Package },
  { to: '/admin/catalogue', label: 'Website content', icon: Boxes },
  { to: '/admin/business', label: 'Business accounts', icon: Briefcase },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { to: '/admin/analytics', label: 'Reports', icon: BarChart3 },
  { to: '/admin/media', label: 'Media', icon: Image },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

function LoginScreen() {
  const { signIn } = useAuth();
  const { brandName } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-accent text-primary-dark">
            <Package className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-white">
            {brandName || 'Admin'}
          </h1>
          <p className="mt-1 text-sm text-white/60">Sign in to manage orders and settings.</p>
        </div>

        <Card className="p-5">
          {!isSupabaseConfigured ? (
            <NotConnectedState />
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              {error && (
                <p className="rounded-card bg-danger/10 p-3 text-sm text-danger">{error}</p>
              )}
              <Button type="submit" size="lg" fullWidth loading={busy}>
                Sign in
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAuth();
  const { brandName } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-accent">
            <Package className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="truncate font-display text-sm font-bold">{brandName || 'Admin'}</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-card px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-ink-muted hover:bg-canvas hover:text-ink',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <p className="px-3 pb-2 text-xs text-ink-muted">{admin?.email}</p>
          <Button variant="ghost" size="sm" fullWidth icon={<LogOut className="h-4 w-4" />} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:hidden"
          style={{ paddingTop: 'var(--safe-top)' }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-card border border-line"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <span className="truncate font-display text-sm font-bold">{brandName || 'Admin'}</span>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {menuOpen && (
          <nav className="animate-slide-up border-b border-line bg-surface p-3 lg:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-card px-3 py-3 text-sm',
                    isActive ? 'bg-primary/10 font-medium text-primary' : 'text-ink',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        <main key={location.pathname} className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-display text-2xl font-bold',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-danger',
          tone === 'default' && 'text-ink',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

function Dashboard() {
  const range = rangeFor('30d');

  const summary = useQuery({
    queryKey: ['analytics', 'summary', range.from, range.to],
    enabled: isSupabaseConfigured,
    queryFn: () => getSummary(range),
  });

  const recent = useQuery({
    queryKey: ['orders', 'recent'],
    enabled: isSupabaseConfigured,
    queryFn: () => listOrders({ limit: 8 }),
  });

  if (!isSupabaseConfigured) {
    return (
      <Card>
        <NotConnectedState />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Last 30 days · {shortDate(range.from)} to {shortDate(range.to)}
        </p>
      </div>

      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : summary.error ? (
        <Card>
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        </Card>
      ) : isEmptySummary(summary.data) ? (
        <Card>
          <EmptyState
            title="No activity recorded yet"
            description="Once orders are placed and expenses are entered, revenue and profit figures appear here. Nothing is estimated — these numbers come straight from your records."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Revenue"
              value={money(Number(summary.data!.revenue))}
              hint={`${fmtCount(summary.data!.revenue_order_count)} delivered and paid`}
              tone="positive"
            />
            <KpiCard label="Expenses" value={money(Number(summary.data!.expenses))} />
            <KpiCard
              label="Net profit"
              value={money(Number(summary.data!.net_profit))}
              tone={Number(summary.data!.net_profit) >= 0 ? 'positive' : 'negative'}
            />
            <KpiCard
              label="Awaiting payment"
              value={money(Number(summary.data!.pending_payment_amount))}
              hint="Not counted as revenue"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Orders" value={fmtCount(summary.data!.total_orders)} />
            <KpiCard label="Delivered" value={fmtCount(summary.data!.delivered_orders)} />
            <KpiCard label="In progress" value={fmtCount(summary.data!.in_progress_orders)} />
            <KpiCard label="Cancelled" value={fmtCount(summary.data!.cancelled_orders)} />
          </div>
        </>
      )}

      <Card>
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <h2 className="text-base font-semibold text-ink">Latest orders</h2>
          <NavLink to="/admin/orders">
            <Button variant="outline" size="sm">
              All orders
            </Button>
          </NavLink>
        </div>

        {recent.isLoading ? (
          <div className="p-5">
            <Spinner />
          </div>
        ) : recent.error ? (
          <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
        ) : (recent.data ?? []).length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Orders placed on the website will appear here as soon as they come in."
          />
        ) : (
          <ul className="divide-y divide-line">
            {(recent.data ?? []).map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-ink">{order.code}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {order.customer_name} → {order.receiver_name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-sm text-ink sm:block">
                    {money(Number(order.total_amount))}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs leading-relaxed text-ink-muted">
        Revenue counts an order only once it is delivered and its payment is verified, using the
        price recorded at booking. Editing the rate chart never changes past orders.
      </p>
    </div>
  );
}

export default function AdminRoutes() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!isAdmin) return <LoginScreen />;

  return (
    <AdminShell>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="riders" element={<Riders />} />
          <Route path="pricing" element={<PricingAreas />} />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="business" element={<BusinessCustomers />} />
          <Route path="payments" element={<Payments />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="media" element={<Media />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="*"
            element={
              <Card>
                <EmptyState title="Page not found" description="Pick a section from the menu." />
              </Card>
            }
          />
        </Routes>
      </Suspense>
    </AdminShell>
  );
}
