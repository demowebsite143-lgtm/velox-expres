import { useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminUI';
import { Button, Card, Select } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/overlays';
import { EmptyState, ErrorState, NotConnectedState, SkeletonCard } from '@/components/ui/states';
import { useToast } from '@/providers/ToastProvider';
import {
  deleteMedia, humanSize, listMedia, uploadMedia, MEDIA_KINDS, MEDIA_KIND_LABELS, type MediaKind,
} from '@/services/mediaService';
import { isSupabaseConfigured } from '@/lib/supabase';
import { copyText } from '@/lib/utils';
import { dateTime } from '@/lib/format';
import type { MediaAsset } from '@/types/database';

export default function Media() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filterKind, setFilterKind] = useState<MediaKind | 'all'>('all');
  const [uploadKind, setUploadKind] = useState<MediaKind>('general');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mediaQuery = useQuery({
    queryKey: ['admin', 'media', filterKind],
    enabled: isSupabaseConfigured,
    queryFn: () => listMedia(filterKind === 'all' ? undefined : filterKind),
  });

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      await uploadMedia(file, uploadKind);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] });
      toast.success('Uploaded');
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  async function onCopy(url: string) {
    const ok = await copyText(url);
    ok ? toast.success('URL copied') : toast.error('Could not copy');
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMedia(deleteTarget);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] });
      toast.success('Deleted');
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div>
        <AdminPageHeader title="Media" />
        <Card><NotConnectedState /></Card>
      </div>
    );
  }

  const rows = mediaQuery.data ?? [];

  return (
    <div>
      <AdminPageHeader
        title="Media"
        description="Upload images here, then paste the URL into a banner, service, or setting."
      />

      <Card className="mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Upload as" value={uploadKind} onChange={(e) => setUploadKind(e.target.value as MediaKind)} className="w-48">
            {MEDIA_KINDS.map((k) => <option key={k} value={k}>{MEDIA_KIND_LABELS[k]}</option>)}
          </Select>
          <Button icon={<Upload className="h-4 w-4" />} loading={uploading} onClick={() => fileInput.current?.click()}>
            Upload image
          </Button>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            className="hidden" onChange={onFileChosen} />
          <p className="text-xs text-ink-muted">PNG, JPG, WebP, SVG or ICO — up to 5 MB.</p>
        </div>
      </Card>

      <div className="mb-4">
        <Select value={filterKind} onChange={(e) => setFilterKind(e.target.value as MediaKind | 'all')} className="w-48">
          <option value="all">All media</option>
          {MEDIA_KINDS.map((k) => <option key={k} value={k}>{MEDIA_KIND_LABELS[k]}</option>)}
        </Select>
      </div>

      {mediaQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : mediaQuery.error ? (
        <Card><ErrorState error={mediaQuery.error} onRetry={() => mediaQuery.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title="No media uploaded yet"
            description="Logos, banners and other images you upload will appear here."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="flex aspect-video items-center justify-center bg-canvas">
                <img src={asset.public_url} alt={asset.alt_text ?? ''} className="h-full w-full object-contain" loading="lazy" />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-ink">{asset.file_name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {MEDIA_KIND_LABELS[asset.kind as MediaKind] ?? asset.kind} · {humanSize(asset.size_bytes)}
                </p>
                <p className="text-xs text-ink-muted">{dateTime(asset.created_at)}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" fullWidth icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => onCopy(asset.public_url)}>
                    Copy URL
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleteTarget(asset)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title="Delete this file?"
        message="If it's used as a logo, banner, or anywhere else, that image will stop showing."
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
      />
    </div>
  );
}
