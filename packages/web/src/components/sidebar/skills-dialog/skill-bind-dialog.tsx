'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AgentIcon } from '@/components/common/agent-icon';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentCandidate, SkillInfo } from './types';

interface SkillBindDialogProps {
  skill: SkillInfo | null;
  agents: AgentCandidate[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function SkillBindDialog({ skill, agents, selected, onToggle, onClose, onConfirm }: SkillBindDialogProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  return (
    <Dialog open={!!skill} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('bindTitle', { name: skill?.name || '' })}</DialogTitle>
          <DialogDescription>{t('bindDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => onToggle(agent.id)}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors',
                )}
              >
                <AgentIcon agentId={agent.id} name={agent.name} avatarUrl={agent.avatarUrl} className="size-5 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{agent.name}</span>
                  {agent.description && (
                    <span className="block truncate text-xs text-muted-foreground">{agent.description}</span>
                  )}
                </span>
                <div
                  className={cn(
                    'flex items-center justify-center size-4 rounded border shrink-0',
                    selected.includes(agent.id)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input',
                  )}
                />
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => {
                const agent = agents.find((a) => a.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                    <AgentIcon agentId={id} name={agent?.name} className="size-3.5 rounded-full" />
                    {agent?.name || id}
                    <button type="button" onClick={() => onToggle(id)} className="hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button onClick={onConfirm}>
              {tc('confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
