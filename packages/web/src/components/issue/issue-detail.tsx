'use client';

import { useEffect, useState, useRef } from 'react';
import { useIssueStore } from '@/stores/issue';
import { useTaskStore } from '@/stores/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Play, RotateCcw, XCircle, Send, User } from 'lucide-react';
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

interface MockComment {
  id: string;
  senderId: string;
  senderRole?: string;
  content: string;
  createdAt: string;
}

const MOCK_COMMENTS: MockComment[] = [
  {
    id: 'c1',
    senderId: 'user',
    content: '这个议题需要优先处理，涉及核心功能模块。',
    createdAt: '2026-05-02T10:30:00Z',
  },
  {
    id: 'c2',
    senderId: 'Planner',
    senderRole: 'planner',
    content: '已分析完成，建议拆分为 3 个子任务：\n\n1. 数据模型重构\n2. API 接口适配\n3. 前端组件更新',
    createdAt: '2026-05-02T10:35:00Z',
  },
  {
    id: 'c3',
    senderId: 'Executor',
    senderRole: 'executor',
    content: '子任务 1 已完成，正在处理子任务 2。预计 30 分钟内完成。',
    createdAt: '2026-05-02T10:45:00Z',
  },
  {
    id: 'c4',
    senderId: 'Reviewer',
    senderRole: 'reviewer',
    content: '代码审查通过，建议合并。',
    createdAt: '2026-05-02T11:00:00Z',
  },
];

interface IssueDetailProps {
  workspaceId: string;
}

export function IssueDetail({ workspaceId }: IssueDetailProps) {
  const { issues, activeIssueId, startIssue } = useIssueStore();
  const { tasks, loadTasks, retryTask, cancelTask } = useTaskStore();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<MockComment[]>(MOCK_COMMENTS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const issue = issues.find((i) => i.id === activeIssueId);

  useEffect(() => {
    if (issue) {
      loadTasks(workspaceId, issue.id);
    }
  }, [issue, workspaceId, loadTasks]);

  const handleSendComment = () => {
    if (!comment.trim()) return;
    setComments(prev => [...prev, {
      id: `c${Date.now()}`,
      senderId: 'user',
      content: comment.trim(),
      createdAt: new Date().toISOString(),
    }]);
    setComment('');
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  if (!issue) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select an issue to view details
      </div>
    );
  }

  const issueTasks = tasks.filter((t) => t.issueId === issue.id);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* Comments */}
        <div className="space-y-0 pt-2 border-t">
          <h3 className="text-sm font-medium mb-3">Comments ({comments.length})</h3>
          {issue.description && (
            <div className="pb-3 border-b">
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">Author</span>
                    <span className="text-[10px] text-muted-foreground">
                      commented {new Date(issue.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {issue.description}
                  </div>
                </div>
              </div>
            </div>
          )}

          {comments.map((c) => (
            <div key={c.id} className="py-3 border-b last:border-b-0">
              <div className="flex items-start gap-2.5">
                <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium shrink-0 ${
                  c.senderId === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {c.senderId === 'user' ? <User className="h-3.5 w-3.5" /> : c.senderId[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {c.senderId === 'user' ? 'You' : c.senderId}
                    </span>
                    {c.senderRole && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {c.senderRole}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {c.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <div>Created: {new Date(issue.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(issue.updatedAt).toLocaleString()}</div>
          {issue.branch && <div>Branch: {issue.branch}</div>}
          {issue.prUrl && <div>PR: {issue.prUrl}</div>}
        </div>
      </div>

      {/* Comment input */}
      <div className="border-t p-3">
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <Textarea
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
              }
            }}
            rows={2}
            className="border-0 resize-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex items-center justify-end px-2 pb-1.5">
            <Button
              size="sm"
              disabled={!comment.trim()}
              onClick={handleSendComment}
              className="h-7 rounded-full text-xs"
            >
              <Send className="h-3 w-3 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
