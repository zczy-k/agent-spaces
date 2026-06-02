'use client';

import { useSortable } from '@dnd-kit/react/sortable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AgentIcon } from '@/components/common/agent-icon';
import { Pencil, Trash2, RotateCcw, XCircle, GripVertical } from 'lucide-react';
import { TASK_STATUS_COLOR } from './issue-status-colors';
import type { Task } from '@agent-spaces/shared';

interface TaskRowProps {
  task: Task;
  index: number;
  workspaceId: string;
  onRetry: (wsId: string, taskId: string) => void;
  onCancel: (wsId: string, taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (wsId: string, taskId: string) => void;
  tTask: (key: string) => string;
}

export function TaskRow({
  task,
  index,
  workspaceId,
  onRetry,
  onCancel,
  onEdit,
  onDelete,
  tTask,
}: TaskRowProps) {
  const isPending = task.status === 'pending';
  const isActive = isPending || task.status === 'running' || task.status === 'reviewing' || task.status === 'retrying';
  const isDraggable = isPending || isActive;

  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    disabled: !isDraggable,
  });

  return (
    <div
      ref={ref}
      className={[
        'flex items-center gap-3 px-3 py-2 rounded-lg border bg-card group transition-colors hover:bg-accent/30',
        isDragging && 'opacity-50 shadow-lg scale-[1.02]',
        !isDraggable && 'opacity-70',
      ].filter(Boolean).join(' ')}
      style={{ cursor: isDraggable ? 'grab' : 'default' }}
    >
      {isDraggable && (
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      {!isDraggable && <div className="w-4 shrink-0" />}
      <AgentIcon agentId={task.agentConfigId} className="h-6 w-6 shrink-0 rounded" />
      <span className="text-sm font-medium min-w-0 shrink truncate">{task.title}</span>
      <Badge variant={TASK_STATUS_COLOR[task.status]} className="text-[10px] shrink-0">
        {tTask(`status.${task.status}`)}
      </Badge>
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {isPending && (
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(task)}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {(isPending || task.status === 'cancelled' || task.status === 'done') && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(workspaceId, task.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        {task.status === 'failed' && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRetry(workspaceId, task.id)}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        {isActive && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCancel(workspaceId, task.id)}>
            <XCircle className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
