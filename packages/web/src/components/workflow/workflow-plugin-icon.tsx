'use client';

import { PackagePlus, Store } from 'lucide-react';

type PluginIconSource =
  | { type: 'url'; url: string }
  | { type: 'builtin'; variant: 'local' | 'store' };

export function PluginIcon({ source, className }: { source: PluginIconSource; className?: string }) {
  if (source.type === 'url') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.url}
        alt=""
        className={className ?? 'h-4 w-4 object-contain'}
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const sibling = img.nextElementSibling as HTMLElement | null;
          if (sibling) sibling.style.display = '';
        }}
      />
    );
  }

  return (
    <span className={className}>
      {source.variant === 'store' ? <Store className="h-4 w-4 text-muted-foreground" /> : <PackagePlus className="h-4 w-4 text-muted-foreground" />}
    </span>
  );
}
