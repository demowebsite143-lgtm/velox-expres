import { requireClient } from '@/lib/supabase';
import type { DistanceMatrixRow, ServiceArea } from '@/types/database';

/**
 * Distance resolution behind a provider interface.
 *
 * V1 ships the admin-maintained matrix, which costs nothing and works
 * offline. A Google Distance Matrix provider can be registered later
 * without the booking flow, the pricing engine or any component
 * changing — they all depend on this interface, not on the table.
 */

export interface DistanceResolution {
  km: number | null;
  source: string;
  /** Set when km is null, so the UI can say something specific. */
  reason?: 'pair_not_configured' | 'provider_unavailable' | 'same_area';
}

export interface DistanceProvider {
  readonly id: string;
  readonly label: string;
  resolve(fromAreaId: string, toAreaId: string): Promise<DistanceResolution>;
  /** Preload so a calculator can resolve many pairs without N queries. */
  warm?(): Promise<void>;
}

/** Pairs are stored once, ordered, and read symmetrically. */
function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export class MatrixDistanceProvider implements DistanceProvider {
  readonly id = 'admin_matrix';
  readonly label = 'Area distance matrix';

  private cache: Map<string, number> | null = null;

  async warm(): Promise<void> {
    const client = requireClient();
    const { data, error } = await client
      .from('distance_matrix')
      .select('area_a_id, area_b_id, distance_km, is_active')
      .eq('is_active', true);
    if (error) throw error;

    this.cache = new Map(
      (data as DistanceMatrixRow[]).map((row) => [
        pairKey(row.area_a_id, row.area_b_id),
        Number(row.distance_km),
      ]),
    );
  }

  async resolve(fromAreaId: string, toAreaId: string): Promise<DistanceResolution> {
    if (fromAreaId === toAreaId) {
      // Same-area deliveries still need a number. The owner sets it by
      // adding a row where both areas are the same; without it we say so
      // rather than guessing zero and pricing the job at the base rate.
      const self = this.cache?.get(pairKey(fromAreaId, toAreaId));
      if (self !== undefined) return { km: self, source: this.id };
      return { km: null, source: this.id, reason: 'same_area' };
    }

    if (!this.cache) await this.warm();
    const km = this.cache?.get(pairKey(fromAreaId, toAreaId));

    if (km === undefined) {
      return { km: null, source: this.id, reason: 'pair_not_configured' };
    }
    return { km, source: this.id };
  }

  invalidate() {
    this.cache = null;
  }
}

/**
 * Placeholder for a future paid provider. It is registered but inert:
 * it reports unavailable rather than pretending to have an answer.
 * Swapping providers is a one-line change in `getDistanceProvider`.
 */
export class GoogleDistanceProvider implements DistanceProvider {
  readonly id = 'google_distance_matrix';
  readonly label = 'Google Distance Matrix';

  async resolve(): Promise<DistanceResolution> {
    return { km: null, source: this.id, reason: 'provider_unavailable' };
  }
}

let activeProvider: DistanceProvider = new MatrixDistanceProvider();

export function getDistanceProvider(): DistanceProvider {
  return activeProvider;
}

export function setDistanceProvider(provider: DistanceProvider) {
  activeProvider = provider;
}

export async function resolveDistance(
  fromAreaId: string,
  toAreaId: string,
): Promise<DistanceResolution> {
  return getDistanceProvider().resolve(fromAreaId, toAreaId);
}

// ---------------------------------------------------------------------
// Matrix administration
// ---------------------------------------------------------------------

export interface MatrixCell {
  areaAId: string;
  areaBId: string;
  distanceKm: number | null;
  rowId: string | null;
  isActive: boolean;
}

export async function listDistanceRows(): Promise<DistanceMatrixRow[]> {
  const client = requireClient();
  const { data, error } = await client.from('distance_matrix').select('*');
  if (error) throw error;
  return data as DistanceMatrixRow[];
}

/** Every unordered pair, including self-pairs, filled in where known. */
export function buildMatrix(
  areas: ServiceArea[],
  rows: DistanceMatrixRow[],
): MatrixCell[] {
  const lookup = new Map(
    rows.map((r) => [pairKey(r.area_a_id, r.area_b_id), r]),
  );
  const cells: MatrixCell[] = [];

  for (let i = 0; i < areas.length; i += 1) {
    for (let j = i; j < areas.length; j += 1) {
      const a = areas[i].id;
      const b = areas[j].id;
      const row = lookup.get(pairKey(a, b));
      cells.push({
        areaAId: a,
        areaBId: b,
        distanceKm: row ? Number(row.distance_km) : null,
        rowId: row?.id ?? null,
        isActive: row?.is_active ?? true,
      });
    }
  }
  return cells;
}

export async function upsertDistance(
  areaAId: string,
  areaBId: string,
  distanceKm: number,
): Promise<void> {
  const client = requireClient();
  const [a, b] = areaAId <= areaBId ? [areaAId, areaBId] : [areaBId, areaAId];

  const { error } = await client
    .from('distance_matrix')
    .upsert(
      { area_a_id: a, area_b_id: b, distance_km: distanceKm, is_active: true },
      { onConflict: 'area_a_id,area_b_id' },
    );
  if (error) throw error;

  const provider = getDistanceProvider();
  if (provider instanceof MatrixDistanceProvider) provider.invalidate();
}

export async function deleteDistance(rowId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('distance_matrix').delete().eq('id', rowId);
  if (error) throw error;

  const provider = getDistanceProvider();
  if (provider instanceof MatrixDistanceProvider) provider.invalidate();
}

/** How complete is the matrix? Drives the admin coverage indicator. */
export function matrixCoverage(cells: MatrixCell[]): {
  filled: number;
  total: number;
  percent: number;
} {
  const filled = cells.filter((c) => c.distanceKm !== null).length;
  const total = cells.length;
  return {
    filled,
    total,
    percent: total === 0 ? 0 : Math.round((filled / total) * 100),
  };
}
