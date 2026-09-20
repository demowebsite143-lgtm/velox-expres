import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { list } from '@/services/crud';
import type {
  Banner,
  ContentSection,
  Faq,
  Offer,
  PricingRule,
  SafetyRule,
  ServiceArea,
  ServiceItem,
  TimeWindow,
  WorkingHour,
} from '@/types/database';

/**
 * Read hooks for published website content. Each returns an empty array
 * rather than throwing when Supabase is not connected, so the public
 * site still renders its structure and shows honest empty states.
 */

const enabled = isSupabaseConfigured;

export function useContentSections(page: string) {
  return useQuery({
    queryKey: ['content', page],
    enabled,
    queryFn: () =>
      list<ContentSection>('content_sections', {
        filters: { page, is_active: true },
        orderBy: 'display_order',
      }),
  });
}

/** Look one section up by key, with a null-safe result. */
export function useSection(page: string, key: string) {
  const query = useContentSections(page);
  return {
    ...query,
    section: query.data?.find((s) => s.section_key === key) ?? null,
  };
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    enabled,
    queryFn: () =>
      list<ServiceItem>('services', { filters: { is_active: true }, orderBy: 'display_order' }),
  });
}

export function useBanners() {
  return useQuery({
    queryKey: ['banners'],
    enabled,
    queryFn: async () => {
      const rows = await list<Banner>('banners', {
        filters: { is_active: true },
        orderBy: 'display_order',
      });
      const now = Date.now();
      return rows.filter(
        (b) =>
          (!b.starts_at || new Date(b.starts_at).getTime() <= now) &&
          (!b.ends_at || new Date(b.ends_at).getTime() >= now),
      );
    },
  });
}

export function useOffers() {
  return useQuery({
    queryKey: ['offers'],
    enabled,
    queryFn: async () => {
      const rows = await list<Offer>('offers', {
        filters: { is_active: true },
        orderBy: 'created_at',
        ascending: false,
      });
      const now = Date.now();
      return rows.filter(
        (o) =>
          (!o.starts_at || new Date(o.starts_at).getTime() <= now) &&
          (!o.ends_at || new Date(o.ends_at).getTime() >= now) &&
          (o.usage_limit === null || o.used_count < o.usage_limit),
      );
    },
  });
}

export function useFaqs() {
  return useQuery({
    queryKey: ['faqs'],
    enabled,
    queryFn: () => list<Faq>('faqs', { filters: { is_active: true }, orderBy: 'display_order' }),
  });
}

export function useSafetyRules() {
  return useQuery({
    queryKey: ['safety_rules'],
    enabled,
    queryFn: () =>
      list<SafetyRule>('safety_rules', { filters: { is_active: true }, orderBy: 'display_order' }),
  });
}

export function useServiceAreas() {
  return useQuery({
    queryKey: ['service_areas'],
    enabled,
    queryFn: () =>
      list<ServiceArea>('service_areas', { filters: { is_active: true }, orderBy: 'display_order' }),
  });
}

export function usePricingRules() {
  return useQuery({
    queryKey: ['pricing_rules'],
    enabled,
    queryFn: () => list<PricingRule>('pricing_rules', { filters: { is_active: true } }),
  });
}

export function useWorkingHours() {
  return useQuery({
    queryKey: ['working_hours'],
    enabled,
    queryFn: () => list<WorkingHour>('working_hours', { orderBy: 'day_of_week' }),
  });
}

export function useTimeWindows(kind?: 'pickup' | 'delivery') {
  return useQuery({
    queryKey: ['time_windows', kind ?? 'all'],
    enabled,
    queryFn: () =>
      list<TimeWindow>('time_windows', {
        filters: kind ? { kind, is_active: true } : { is_active: true },
        orderBy: 'display_order',
      }),
  });
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
