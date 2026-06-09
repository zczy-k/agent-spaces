'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Music, Play, Table2 } from 'lucide-react';
import { NodeMediaPreview, type MediaItem } from '@/components/ui/media-gallery';
import { cn } from '@/lib/utils';

type DisplayNodeViewProps = {
  data: Record<string, unknown>;
};

type GalleryItem = {
  id?: string;
  src: string;
  thumb?: string;
  type?: 'image' | 'video';
  caption?: string;
};

type TrackItem = {
  id?: string;
  src: string;
  title?: string;
  cover?: string;
  duration?: number;
};

type TableHeaderItem = {
  id: string;
  title?: string;
  type?: string;
};

type TableCellItem = {
  id: string;
  data: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function galleryItems(data: Record<string, unknown>): GalleryItem[] {
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .map((item) => {
      const record = asRecord(item);
      const src = readString(record.src);
      if (!src) return null;
      const type = record.type === 'video' ? 'video' : 'image';
      return {
        id: readString(record.id),
        src,
        thumb: readString(record.thumb),
        type,
        caption: readString(record.caption),
      };
    })
    .filter((item): item is GalleryItem => item !== null);
}

function trackItems(data: Record<string, unknown>): TrackItem[] {
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  return tracks
    .map((track) => {
      const record = asRecord(track);
      const src = readString(record.src);
      if (!src) return null;
      return {
        id: readString(record.id),
        src,
        title: readString(record.title),
        cover: readString(record.cover),
        duration: readNumber(record.duration),
      };
    })
    .filter((track): track is TrackItem => track !== null);
}

function tableHeaders(data: Record<string, unknown>): TableHeaderItem[] {
  const headers = Array.isArray(data.headers) ? data.headers : [];
  return headers
    .map((header) => {
      const record = asRecord(header);
      const id = readString(record.id);
      if (!id) return null;
      return {
        id,
        title: readString(record.title),
        type: readString(record.type),
      };
    })
    .filter((header): header is TableHeaderItem => header !== null);
}

function tableCells(data: Record<string, unknown>): TableCellItem[] {
  const cells = Array.isArray(data.cells) ? data.cells : [];
  return cells
    .map((cell) => {
      const record = asRecord(cell);
      const id = readString(record.id);
      if (!id) return null;
      return {
        id,
        data: parseJsonRecord(record.data),
      };
    })
    .filter((cell): cell is TableCellItem => cell !== null);
}

function EmptyDisplay({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center text-[11px] text-muted-foreground">
      <div className="text-muted-foreground/70">{icon}</div>
      <div>{text}</div>
    </div>
  );
}

export function GalleryPreviewView({ data }: DisplayNodeViewProps) {
  const items = galleryItems(data);
  const mediaItems: MediaItem[] = items.map(item => ({
    src: item.src,
    thumb: item.thumb,
    type: item.type,
    alt: item.caption || item.src,
  }));

  if (items.length === 0) {
    return <EmptyDisplay icon={<Play className="h-5 w-5" />} text="暂无资源" />;
  }

  return (
    <div className="nodrag nopan flex h-full w-full flex-col overflow-hidden rounded-lg bg-background">
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 p-2">
        <div className="grid max-h-full w-full grid-cols-3 gap-1 overflow-hidden">
          {items.slice(0, 6).map((item, index) => (
            <div
              key={item.id || `${item.src}-${index}`}
              className="relative aspect-square overflow-hidden rounded border border-border bg-muted"
            >
              {item.type === 'video' ? (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Play className="h-4 w-4" />
                </div>
              ) : (
                <img
                  src={item.thumb || item.src}
                  alt={item.caption || ''}
                  className="h-full w-full object-cover"
                />
              )}
              {index === 5 && items.length > 6 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs font-medium">
                  +{items.length - 6}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <NodeMediaPreview items={mediaItems} />
    </div>
  );
}

export function MusicPlayerView({ data }: DisplayNodeViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const tracks = trackItems(data);
  const firstTrack = tracks[0];
  const volume = readNumber(data.volume) ?? 80;
  const loop = data.loop === true;

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  if (!firstTrack) {
    return <EmptyDisplay icon={<Music className="h-5 w-5" />} text="暂无音频" />;
  }

  return (
    <div className="nodrag nopan flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="flex min-h-0 flex-1 items-center gap-2 p-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
          {firstTrack.cover ? (
            <img src={firstTrack.cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">
            {firstTrack.title || firstTrack.src.split('/').pop() || 'Audio'}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{tracks.length} tracks</span>
            {formatDuration(firstTrack.duration) ? <span>{formatDuration(firstTrack.duration)}</span> : null}
            {loop ? <span>Loop</span> : null}
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 p-2">
        <audio
          ref={audioRef}
          src={firstTrack.src}
          controls
          loop={loop}
          preload="metadata"
          className="h-8 w-full"
        />
      </div>
    </div>
  );
}

export function TableDisplayView({ data }: DisplayNodeViewProps) {
  const headers = tableHeaders(data);
  const cells = tableCells(data);
  const selectionMode = readString(data.selectionMode) || 'none';

  if (headers.length === 0) {
    return <EmptyDisplay icon={<Table2 className="h-5 w-5" />} text="暂无表头" />;
  }

  return (
    <div className="nodrag nopan flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="flex items-center justify-between border-b border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
        <span>{cells.length} rows</span>
        <span className={cn(selectionMode !== 'none' && 'text-foreground')}>
          {selectionMode === 'single' ? 'Single' : selectionMode === 'multi' ? 'Multi' : 'No selection'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              {selectionMode !== 'none' ? <th className="w-5 px-1 py-1" /> : null}
              {headers.map(header => (
                <th key={header.id} className="max-w-24 truncate px-1.5 py-1 text-left font-medium">
                  {header.title || header.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.slice(0, 8).map(cell => (
              <tr key={cell.id} className="border-t border-border/50">
                {selectionMode !== 'none' ? (
                  <td className="px-1 py-1">
                    <span className="block h-2.5 w-2.5 rounded border border-border" />
                  </td>
                ) : null}
                {headers.map(header => (
                  <td key={header.id} className="max-w-24 truncate px-1.5 py-1">
                    {String(cell.data[header.id] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
