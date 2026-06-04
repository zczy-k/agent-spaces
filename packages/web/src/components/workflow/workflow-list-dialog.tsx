'use client';

import { useMemo } from 'react';
import type { WorkflowTemplate } from '@agent-spaces/shared';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function WorkflowListDialog({
  open, workflows, onSelect, onCreate, onClose,
}: {
  open: boolean;
  workflows: WorkflowTemplate[];
  onSelect: (wf: WorkflowTemplate) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const sorted = useMemo(
    () => [...workflows].sort((a, b) =>
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    ),
    [workflows],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>工作流</DialogTitle>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {sorted.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">暂无工作流</div>
          )}
          {sorted.map(wf => (
            <button
              key={wf.id}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors flex items-center justify-between"
              onClick={() => onSelect(wf)}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{wf.name || '未命名'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {wf.nodes?.length || 0} 个节点
                </div>
              </div>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-1" /> 新建工作流
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
