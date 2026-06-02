'use client';

import type { ReactNode } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { TaskRow } from './task-row';
import type { Task } from '@agent-spaces/shared';

interface IssueDetailTasksPanelProps {
  issue: { id: string; tasks?: string[] };
  workspaceId: string;
  issueTasks: Task[];
  t: (key: string, params?: Record<string, string | number | Date>) => string;
  tTask: (key: string) => string;
  retryTask: (wsId: string, taskId: string) => void;
  cancelTask: (wsId: string, taskId: string) => void;
  reorderTasks: (wsId: string, issueId: string, taskIds: string[]) => void;
  deleteTask: (wsId: string, taskId: string) => void;
  onEditTask: (task: Task) => void;
  headerAction?: ReactNode;
}

export function IssueDetailTasksPanel({
  issue,
  workspaceId,
  issueTasks,
  t,
  tTask,
  retryTask,
  cancelTask,
  reorderTasks,
  deleteTask,
  onEditTask,
  headerAction,
}: IssueDetailTasksPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {t('detail.tasks', { count: issueTasks.length })}
        </h3>
        {headerAction}
      </div>
      {issueTasks.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t('detail.noTasks')}</div>
      ) : (
        <DragDropProvider
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onDragEnd={(event: any) => {
            if (event.canceled) return;
            const source = event.operation?.source;
            const target = event.operation?.target;
            if (!source || !target || source.id === target.id) return;

            const ids = issueTasks.map((t) => t.id);
            const fromIdx = ids.indexOf(String(source.id));
            const toIdx = ids.indexOf(String(target.id));
            if (fromIdx === -1 || toIdx === -1) return;

            const reordered = Array.from(ids);
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(toIdx, 0, moved);

            reorderTasks(workspaceId, issue.id, reordered);
          }}
        >
          <div className="space-y-1">
            {issueTasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                index={idx}
                workspaceId={workspaceId}
                onRetry={retryTask}
                onCancel={cancelTask}
                onEdit={onEditTask}
                onDelete={deleteTask}
                tTask={tTask}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
    </div>
  );
}
