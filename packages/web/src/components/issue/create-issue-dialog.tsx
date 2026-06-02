'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  defaultTitle?: string;
  defaultDescription?: string;
  onSubmit: (data: { title: string; description: string; members: string[]; workflowId?: string }) => void;
}

export function CreateIssueDialog({ open, onOpenChange, agents = [], defaultTitle, defaultDescription, onSubmit }: CreateIssueDialogProps) {
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

  useEffect(() => {
    if (open && defaultDescription) setDesc(defaultDescription);
  }, [open, defaultDescription]);

  useEffect(() => {
    if (open && defaultTitle) setTitle(defaultTitle);
  }, [open, defaultTitle]);

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
    setMembers((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      // 用户手动改了 members，取消 workflow 选择
      if (selectedWorkflowId) setSelectedWorkflowId('');
      return next;
    });
  };

  const handleSubmit = () => {
    if (!title.trim() && !desc.trim()) return;
    onSubmit({ title: title.trim(), description: desc.trim(), members, workflowId: selectedWorkflowId || undefined });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>
        {/* 移动端: 垂直布局; 宽屏: 左右布局 */}
        <div className="flex flex-col lg:flex-row gap-4 pt-2 min-h-0">
          {/* 左侧: 表单 */}
          <div className="flex-1 space-y-3">
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
              className="max-h-48 resize-none"
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
                      const agentIds = template.nodes.filter(n => n.type === 'agent').map(n => n.data.agentConfigId as string);
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

            {/* 移动端: MemberPicker 在表单下方 */}
            <div className="lg:hidden">
              <MemberPicker
                key={String(open)}
                candidates={candidates}
                selected={members}
                onToggle={toggleMember}
                label={t('create.membersLabel')}
                searchPlaceholder={t('create.searchAgent')}
                emptyText={t('create.noAgents')}
              />
            </div>
          </div>

          {/* 宽屏: MemberPicker 在右侧 */}
          <div className="hidden lg:flex lg:w-64 xl:w-72 flex-col border-l pl-4 min-h-0">
            <MemberPicker
              key={String(open)}
              candidates={candidates}
              selected={members}
              onToggle={toggleMember}
              label={t('create.membersLabel')}
              searchPlaceholder={t('create.searchAgent')}
              emptyText={t('create.noAgents')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>{tc('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() && !desc.trim()}>
            {t('create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
