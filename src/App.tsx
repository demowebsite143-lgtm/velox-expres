import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Spinner } from '@/components/ui';

/**
 * Three route trees, three audiences:
 *
 *   /        public site      — anonymous, mobile first
 *   /admin   control centre   — authenticated admins only
 *   /r/:token rider job sheet — no account, single-order token
 *
 * The admin bundle is lazy so a customer opening the homepage never
 * downloads the dashboard, charts or the whole settings editor.
 */

const Home = lazy(() => import('@/pages/public/Home'));
const Services = lazy(() => import('@/pages/public/Services'));
const RateCalculator = lazy(() => import('@/pages/public/RateCalculator'));
const BookCourier = lazy(() => import('@/pages/public/BookCourier'));
const TrackOrder = lazy(() => import('@/pages/public/TrackOrder'));
const Business = lazy(() => import('@/pages/public/Business'));
const Offers = lazy(() => import('@/pages/public/Offers'));
const About = lazy(() => import('@/pages/public/About'));
const Safety = lazy(() => import('@/pages/public/Safety'));
const Faq = lazy(() => import('@/pages/public/Faq'));
const Contact = lazy(() => import('@/pages/public/Contact'));
const LegalPage = lazy(() => import('@/pages/public/LegalPage'));
const NotFound = lazy(() => import('@/pages/public/NotFound'));

const RiderOrder = lazy(() => import('@/pages/rider/RiderOrder'));
const AdminRoutes = lazy(() => import('@/pages/admin/AdminRoutes'));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="rate-calculator" element={<RateCalculator />} />
          <Route path="book" element={<BookCourier />} />
          <Route path="track" element={<TrackOrder />} />
          <Route path="business" element={<Business />} />
          <Route path="offers" element={<Offers />} />
          <Route path="about" element={<About />} />
          <Route path="safety" element={<Safety />} />
          <Route path="faq" element={<Faq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<LegalPage page="privacy" />} />
          <Route path="terms" element={<LegalPage page="terms" />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Rider job sheet. No layout chrome — it is a work tool. */}
        <Route path="/r/:token" element={<RiderOrder />} />

        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
