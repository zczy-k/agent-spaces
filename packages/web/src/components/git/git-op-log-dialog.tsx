"use client";

import type { GitOperationEntry } from "@agent-spaces/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: GitOperationEntry[];
  loading: boolean;
}

export function GitOpLogDialog({ open, onOpenChange, entries, loading }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('git.commits');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('operationLogTitle', { count: entries.length })}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">{tc('loading')}</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">{t('noOperations')}</div>
          ) : (
            entries.map((entry) => (
              <details key={entry.id} className="group border-b">
                <summary className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-accent select-none list-none">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.error ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {entry.error ? 'FAIL' : 'OK'}
                  </span>
                  <span className="shrink-0 font-mono font-medium text-foreground">{entry.operation}</span>
                  {Object.keys(entry.input).length > 0 && (
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {Object.entries(entry.input).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${String(v)}`).join(' ')}
                    </span>
                  )}
                  <span className="shrink-0 text-muted-foreground">{entry.duration}ms</span>
                  <span className="shrink-0 text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="shrink-0 text-muted-foreground group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="px-3 pb-2 space-y-1 text-xs font-mono">
                  {entry.error && (
                    <div className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">{entry.error}</div>
                  )}
                  {entry.output !== undefined && !entry.error && (
                    <pre className="text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-auto">{typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2)}</pre>
                  )}
                </div>
              </details>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
