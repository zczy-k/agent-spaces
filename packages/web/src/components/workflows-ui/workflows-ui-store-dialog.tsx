'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Store } from 'lucide-react';
import { fetchStoreIndex, resolveStoreUrl } from '@/lib/agent-store';
import { AgentIcon } from '@/components/common/agent-icon';
import { sdk } from '@/lib/sdk';

interface WorkflowsUiStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface WorkflowUiIndexItem {
  id: string;
  name: string;
  filename: string;
  icon?: string;
  iconUrl?: string;
}

export function WorkflowsUiStoreDialog({ open, onOpenChange, onImported }: WorkflowsUiStoreDialogProps) {
  const t = useTranslations('workflows-ui');
  const [templates, setTemplates] = useState<WorkflowUiIndexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const index = await fetchStoreIndex<WorkflowUiIndexItem>('workflow-ui/index.json');
      setTemplates(index);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const handleImport = async (item: WorkflowUiIndexItem) => {
    setImporting(item.id);
    try {
      const url = resolveStoreUrl(`workflow-ui/${item.filename}`);
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const zip = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const name = item.name;
      await sdk.workflowUi.importZip({ zip, name });
      onImported();
      onOpenChange(false);
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {t('store.title')}
          </DialogTitle>
          <DialogDescription>{t('store.description')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{t('store.loading')}</div>
          ) : templates.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{t('store.empty')}</div>
          ) : (
            <div className="flex flex-col gap-3 pr-2">
              {templates.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AgentIcon
                        name={item.name}
                        avatarUrl={item.iconUrl ? resolveStoreUrl(item.iconUrl) : undefined}
                        icon={item.icon}
                        className="size-6 rounded shrink-0"
                      />
                      <span className="font-medium text-sm truncate">{item.name}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={importing !== null}
                      onClick={() => handleImport(item)}
                    >
                      {importing === item.id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <>
                          <Download className="size-3.5 mr-1" />
                          {t('store.import')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
