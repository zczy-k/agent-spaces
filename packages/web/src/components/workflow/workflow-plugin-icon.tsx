'use client';

import { Package, PackagePlus, Store } from 'lucide-react';
import { useEffect, useState } from 'react';

type PluginIconSource =
  | { type: 'url'; url: string }
  | { type: 'builtin'; variant: 'local' | 'store' };

export function PluginIcon({ source, className }: { source: PluginIconSource; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = source.type === 'url' ? source.url : '';

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (source.type === 'url' && !failed) {
    return (
      <img
        src={url}
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
