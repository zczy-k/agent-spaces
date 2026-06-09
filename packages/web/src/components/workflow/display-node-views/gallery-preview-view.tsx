'use client';

import { Play } from 'lucide-react';
import { NodeMediaPreview, type MediaItem } from '@/components/ui/media-gallery';
import { type DisplayNodeViewProps, galleryItems, EmptyDisplay } from './utils';

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
