'use client';

import { Package, PackagePlus, Store } from 'lucide-react';
import { useState } from 'react';

type PluginIconSource =
  | { type: 'url'; url: string }
  | { type: 'builtin'; variant: 'local' | 'store' };

export function PluginIcon({ source, className }: { source: PluginIconSource; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (source.type === 'url' && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.url}
        alt=""
        className={className ?? 'h-8 w-8 object-contain'}
        onError={() => setFailed(true)}
      />
    );
  }

  const icon = source.type === 'builtin'
    ? (source.variant === 'store' ? <Store className="h-4 w-4 text-muted-foreground" /> : <PackagePlus className="h-4 w-4 text-muted-foreground" />)
    : <Package className="h-4 w-4 text-muted-foreground" />;

  return <span className={className}>{icon}</span>;
}
