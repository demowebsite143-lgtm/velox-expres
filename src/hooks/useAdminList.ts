import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { create, list, remove, reorder, setActive, update, type ListOptions } from '@/services/crud';
import { useToast } from '@/providers/ToastProvider';

/**
 * Generic list + mutate hook for the admin CRUD screens (riders,
 * services, banners, offers, FAQs, safety rules, service areas,
 * pricing rules, expenses). Anything with real business logic beyond
 * plain rows (orders, dispatch, settings) has its own hook instead.
 */
export function useAdminList<T extends { id: string }>(
  table: string,
  options: ListOptions = {},
  queryKeyExtra: unknown[] = [],
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const queryKey = ['admin', table, ...queryKeyExtra];

  const query = useQuery({
    queryKey,
    enabled: isSupabaseConfigured,
    queryFn: () => list<T>(table, options),
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey]);

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => create<T>(table, values),
    onSuccess: () => {
      invalidate();
      toast.success('Saved');
    },
    onError: (err) => toast.error('Could not save', err instanceof Error ? err.message : undefined),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      update<T>(table, id, values),
    onSuccess: () => {
      invalidate();
      toast.success('Saved');
    },
    onError: (err) => toast.error('Could not save', err instanceof Error ? err.message : undefined),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove(table, id),
    onSuccess: () => {
      invalidate();
      toast.success('Deleted');
    },
    onError: (err) => toast.error('Could not delete', err instanceof Error ? err.message : undefined),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setActive(table, id, isActive),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not update', err instanceof Error ? err.message : undefined),
  });

  const reorderMutation = useMutation({
    mutationFn: (rows: { id: string }[]) => reorder(table, rows),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not reorder', err instanceof Error ? err.message : undefined),
  });

  return {
    ...query,
    rows: query.data ?? [],
    create: createMutation.mutateAsync,
    creating: createMutation.isPending,
    update: (id: string, values: Record<string, unknown>) => updateMutation.mutateAsync({ id, values }),
    updating: updateMutation.isPending,
    remove: removeMutation.mutateAsync,
    removing: removeMutation.isPending,
    toggleActive: (id: string, isActive: boolean) => toggleActiveMutation.mutateAsync({ id, isActive }),
    reorder: reorderMutation.mutateAsync,
    invalidate,
  };
}
