'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { useWorkflowStore } from '@/stores/workflow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface AgentPickerItem {
  id: string;
  name: string;
  avatarUrl?: string;
  description?: string;
}

interface AgentPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  agents: AgentPickerItem[];
  selected: string[];
  onToggle: (id: string) => void;
  cancelText?: string;
  confirmText?: string;
  loading?: boolean;
  /** 开启后点击 Agent 立即选中并关闭对话框 */
  singleSelect?: boolean;
}

export function AgentPickerDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  agents,
  selected,
  onToggle,
  cancelText,
  confirmText,
  loading,
  singleSelect,
}: AgentPickerDialogProps) {
  const { workflows } = useWorkflowStore();
  const [workflowId, setWorkflowId] = useState<string>('');

  useEffect(() => {
    if (open) setWorkflowId('');
  }, [open]);

  const filteredAgents = useMemo(() => {
    if (!workflowId || workflowId === '__all__') return agents;
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return agents;
    const agentIds = new Set(
      wf.nodes
        .filter((n) => n.type === 'agent')
        .map((n) => n.data.agentConfigId),
    );
    return agents.filter((a) => agentIds.has(a.id));
  }, [agents, workflowId, workflows]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {workflows.length > 0 && (
          <div className="shrink-0 px-6 pb-3">
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="按 Workflow 过滤" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部 Agent</SelectItem>
                {workflows.map((wf) => (
                  <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-h-0 flex-1 pb-2 overflow-y-auto px-6 space-y-3">
          <div className="space-y-0.5">
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  onToggle(agent.id);
                  if (singleSelect) onConfirm();
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors"
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
          {!singleSelect && selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => {
                const agent = agents.find((a) => a.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs max-w-[160px] min-w-0">
                    <AgentIcon agentId={id} name={agent?.name} avatarUrl={agent?.avatarUrl} className="size-3.5 rounded-full shrink-0" />
                    <span className="truncate">{agent?.name || id}</span>
                    <button type="button" onClick={() => onToggle(id)} className="hover:text-destructive shrink-0 cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {!singleSelect && (
        <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {cancelText || 'Cancel'}
          </Button>
          <Button onClick={onConfirm} disabled={loading || selected.length === 0}>
            {confirmText || 'Confirm'}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
