'use client';

import { useEffect } from 'react';
import { useIssueStore } from '@/stores/issue';
import { useTaskStore } from '@/stores/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, RotateCcw, XCircle } from 'lucide-react';
import type { IssueStatus, TaskStatus } from '@agent-spaces/shared';

const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  in_progress: 'In Progress',
  review_pending: 'Review Pending',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  completed: 'Completed',
  archived: 'Archived',
  error: 'Error',
};

const ISSUE_STATUS_COLOR: Record<IssueStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  planned: 'outline',
  in_progress: 'default',
  review_pending: 'outline',
  changes_requested: 'destructive',
  approved: 'default',
  completed: 'secondary',
  archived: 'outline',
  error: 'destructive',
};

const TASK_STATUS_COLOR: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  running: 'default',
  waiting_review: 'outline',
  retrying: 'outline',
  done: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  waiting_review: 'Waiting Review',
  retrying: 'Retrying',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

interface IssueDetailProps {
  workspaceId: string;
}

export function IssueDetail({ workspaceId }: IssueDetailProps) {
  const { issues, activeIssueId, startIssue } = useIssueStore();
  const { tasks, loadTasks, retryTask, cancelTask } = useTaskStore();

  const issue = issues.find((i) => i.id === activeIssueId);

  useEffect(() => {
    if (issue) {
      loadTasks(workspaceId, issue.id);
    }
  }, [issue, workspaceId, loadTasks]);

  if (!issue) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select an issue to view details
      </div>
    );
  }

  const issueTasks = tasks.filter((t) => t.issueId === issue.id);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold flex-1">{issue.title}</h2>
            <Badge variant={ISSUE_STATUS_COLOR[issue.status]}>
              {ISSUE_STATUS_LABEL[issue.status]}
            </Badge>
          </div>
          {issue.description && (
            <p className="text-sm text-muted-foreground">{issue.description}</p>
          )}
          <div className="flex gap-2">
            {issue.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => startIssue(workspaceId, issue.id)}>
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Tasks ({issueTasks.length})
          </h3>
          {issueTasks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tasks yet</div>
          ) : (
            <div className="space-y-1">
              {issueTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-md border text-sm"
                >
                  <Badge variant={TASK_STATUS_COLOR[task.status]} className="text-[10px]">
                    {TASK_STATUS_LABEL[task.status]}
                  </Badge>
                  <span className="flex-1 truncate">{task.title}</span>
                  {task.status === 'failed' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => retryTask(workspaceId, task.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  {(task.status === 'pending' || task.status === 'running' || task.status === 'retrying') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => cancelTask(workspaceId, task.id)}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <div>Created: {new Date(issue.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(issue.updatedAt).toLocaleString()}</div>
          {issue.branch && <div>Branch: {issue.branch}</div>}
          {issue.prUrl && <div>PR: {issue.prUrl}</div>}
        </div>
      </div>
    </ScrollArea>
  );
}
