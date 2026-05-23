'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MemberPicker } from '@/components/common/member-picker';
import { getMemberDisplayName } from '@/lib/agent-members';
import { useWorkflowStore } from '@/stores/workflow';

import type { AgentConfig } from '@agent-spaces/shared';

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents?: AgentConfig[];
  onSubmit: (data: { title: string; description: string; members: string[]; workflowId?: string }) => void;
}

export function CreateIssueDialog({ open, onOpenChange, agents = [], onSubmit }: CreateIssueDialogProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const { workflows, loadWorkflows } = useWorkflowStore();
  const t = useTranslations('issue');
  const tc = useTranslations('common');

  const candidates = agents
    .filter((a) => a.enabled !== false)
    .map((a, i) => ({ id: a.id, label: getMemberDisplayName(agents, a.id), sortIndex: i }));

  useEffect(() => {
    if (open) loadWorkflows();
  }, [open, loadWorkflows]);

  const handleClose = (val: boolean) => {
    if (!val) {
      setTitle('');
      setDesc('');
      setMembers([]);
      setSelectedWorkflowId('');
    }
    onOpenChange(val);
  };

  const toggleMember = (id: string) => {
    setMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: desc.trim(), members, workflowId: selectedWorkflowId || undefined });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            placeholder={t('create.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
          <Textarea
            placeholder={t('create.descriptionPlaceholder')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Workflow Template</label>
            <select
              value={selectedWorkflowId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedWorkflowId(value);
                if (value) {
                  const template = workflows.find(w => w.id === value);
                  if (template) {
                    const agentIds = template.nodes.map(n => n.data.agentConfigId);
                    setMembers(prev => Array.from(new Set([...prev, ...agentIds])));
                  }
                }
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None (use default pipeline)</option>
              {workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.nodes.length} agents)</option>
              ))}
            </select>
          </div>

          <MemberPicker
            key={String(open)}
            candidates={candidates}
            selected={members}
            onToggle={toggleMember}
            label={t('create.membersLabel')}
            searchPlaceholder={t('create.searchAgent')}
            emptyText={t('create.noAgents')}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>{tc('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={!title.trim()}>
              {t('create.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
