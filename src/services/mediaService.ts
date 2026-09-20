import { requireClient } from '@/lib/supabase';
import type { MediaAsset } from '@/types/database';

/**
 * Supabase Storage wrapper. Nothing in the app references a file URL
 * directly — components read the URL out of settings or a row, so
 * replacing a logo never means touching code.
 */

export const MEDIA_BUCKET = 'media';

export const MEDIA_KINDS = [
  'logo',
  'favicon',
  'app_icon',
  'hero',
  'banner',
  'service',
  'offer',
  'payment_qr',
  'general',
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  logo: 'Logo',
  favicon: 'Favicon',
  app_icon: 'App icon',
  hero: 'Hero image',
  banner: 'Banner',
  service: 'Service image',
  offer: 'Offer image',
  payment_qr: 'Payment QR',
  general: 'General',
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon'];

export function validateFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) {
    return 'Use a PNG, JPG, WebP, SVG or ICO file.';
  }
  if (file.size > MAX_BYTES) {
    return 'That file is larger than 5 MB. Compress it and try again.';
  }
  return null;
}

function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-');
}

export async function uploadMedia(
  file: File,
  kind: MediaKind = 'general',
  altText?: string,
): Promise<MediaAsset> {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const client = requireClient();
  const path = `${kind}/${Date.now()}-${safeName(file.name)}`;

  const { error: uploadError } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);

  const { data, error } = await client
    .from('media_assets')
    .insert({
      bucket: MEDIA_BUCKET,
      path,
      public_url: urlData.publicUrl,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      kind,
      alt_text: altText ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  return data as MediaAsset;
}

export async function listMedia(kind?: MediaKind): Promise<MediaAsset[]> {
  const client = requireClient();
  let query = client.from('media_assets').select('*').order('created_at', { ascending: false });
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MediaAsset[];
}

export async function deleteMedia(asset: MediaAsset): Promise<void> {
  const client = requireClient();
  const { error: storageError } = await client.storage
    .from(asset.bucket)
    .remove([asset.path]);
  if (storageError) throw storageError;

  const { error } = await client.from('media_assets').delete().eq('id', asset.id);
  if (error) throw error;
}

export function humanSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
