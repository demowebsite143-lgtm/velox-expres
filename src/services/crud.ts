import { requireClient } from '@/lib/supabase';

/**
 * Thin generic CRUD over Supabase tables. Admin screens for banners,
 * services, offers, FAQs, areas and safety rules are structurally the
 * same, so they share this instead of repeating a query builder each.
 *
 * Anything with real business logic (orders, pricing, dispatch) gets a
 * dedicated service and does not come through here.
 */

export interface ListOptions {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  filters?: Record<string, string | number | boolean | null>;
  search?: { column: string; term: string };
}

export async function list<T>(table: string, options: ListOptions = {}): Promise<T[]> {
  const client = requireClient();
  let query = client.from(table).select('*');

  for (const [column, value] of Object.entries(options.filters ?? {})) {
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }

  if (options.search?.term) {
    query = query.ilike(options.search.column, `%${options.search.term}%`);
  }
  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function getOne<T>(table: string, id: string): Promise<T | null> {
  const client = requireClient();
  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as T) ?? null;
}

export async function create<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const client = requireClient();
  const { data, error } = await client.from(table).insert(values).select().single();
  if (error) throw error;
  return data as T;
}

export async function update<T>(
  table: string,
  id: string,
  values: Record<string, unknown>,
): Promise<T> {
  const client = requireClient();
  const { data, error } = await client
    .from(table)
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as T;
}

export async function remove(table: string, id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function setActive(table: string, id: string, isActive: boolean) {
  return update(table, id, { is_active: isActive });
}

/** Persist a drag-reorder as one round trip per moved row. */
export async function reorder(
  table: string,
  ordered: { id: string }[],
): Promise<void> {
  const client = requireClient();
  await Promise.all(
    ordered.map((row, index) =>
      client.from(table).update({ display_order: index + 1 }).eq('id', row.id),
    ),
  );
}
