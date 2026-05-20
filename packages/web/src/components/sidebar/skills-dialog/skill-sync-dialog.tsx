'use client';

import 'react';
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
import { AgentIcon } from '@/components/common/agent-icon';
import { cn } from '@/lib/utils';
import type { SkillSyncItem } from './types';

interface SkillSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SkillSyncItem[];
  selected: Set<string>;
  onToggle: (agentId: string, skillName: string) => void;
  onConfirm: () => void;
}

export function SkillSyncDialog({ open, onOpenChange, items, selected, onToggle, onConfirm }: SkillSyncDialogProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('syncTitle')}</DialogTitle>
          <DialogDescription>{t('syncDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              {t('syncEmpty')}
            </div>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-1">
                {items.map((item) => {
                  const key = `${item.agentId}::${item.skillName}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onToggle(item.agentId, item.skillName)}
                      className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors"
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center size-4 rounded border shrink-0',
                          selected.has(key)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input',
                        )}
                      />
                      <AgentIcon agentId={item.agentId} name={item.agentName} className="size-5 rounded-full" />
                      <span className="min-w-0 flex-1 truncate">{item.agentName}</span>
                      <span className="text-muted-foreground text-xs shrink-0">{item.skillName}.md</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          {items.length > 0 && (
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tc('cancel')}
              </Button>
              <Button onClick={onConfirm} disabled={selected.size === 0}>
                {t('syncConfirm')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
