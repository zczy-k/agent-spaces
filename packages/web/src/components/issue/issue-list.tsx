'use client';

import { useEffect, useState, useRef } from 'react';
import { useIssueStore } from '@/stores/issue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, CircleDot, ArrowLeft, Send, User } from 'lucide-react';
import type { IssueStatus } from '@agent-spaces/shared';

const STATUS_LABEL: Record<IssueStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  in_progress: 'In Progress',
  review_pending: 'Review',
  changes_requested: 'Changes',
  approved: 'Approved',
  completed: 'Completed',
  archived: 'Archived',
  error: 'Error',
};

const STATUS_COLOR: Record<IssueStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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

const GROUP_ORDER: IssueStatus[] = [
  'in_progress', 'review_pending', 'changes_requested',
  'draft', 'planned', 'approved', 'completed', 'error', 'archived',
];

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

interface IssueListProps {
  workspaceId: string;
}

export function IssueList({ workspaceId }: IssueListProps) {
  const { issues, activeIssueId, loading, loadIssues, createIssue, setActiveIssue } = useIssueStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<MockComment[]>(MOCK_COMMENTS);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadIssues(workspaceId);
  }, [workspaceId, loadIssues]);

  const handleSelectIssue = (id: string) => {
    setActiveIssue(id);
    setView('detail');
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createIssue(workspaceId, title.trim(), desc.trim());
    setTitle('');
    setDesc('');
    setOpen(false);
  };

  const handleSendComment = () => {
    if (!comment.trim()) return;
    const newComment: MockComment = {
      id: `c${Date.now()}`,
      senderId: 'user',
      content: comment.trim(),
      createdAt: new Date().toISOString(),
    };
    setComments(prev => [...prev, newComment]);
    setComment('');
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  const issue = issues.find(i => i.id === activeIssueId);

  if (view === 'detail' && issue) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setView('list')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate flex-1">{issue.title}</span>
          <Badge variant={STATUS_COLOR[issue.status]} className="text-[10px] shrink-0">
            {STATUS_LABEL[issue.status]}
          </Badge>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {issue.description && (
            <div className="px-3 py-3 border-b">
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
            <div key={c.id} className="px-3 py-3 border-b last:border-b-0">
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

        <div className="border-t p-2">
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

  const grouped = GROUP_ORDER
    .map((status) => ({
      status,
      items: issues.filter((i) => i.status === status),
    }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium">Issues</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6" />}>
              <Plus className="h-4 w-4" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Textarea
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
              />
              <Button onClick={handleCreate} disabled={!title.trim()}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        {grouped.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No issues yet</div>
        )}
        {grouped.map((group) => (
          <div key={group.status}>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">
              {STATUS_LABEL[group.status]} ({group.items.length})
            </div>
            {group.items.map((issue) => (
              <button
                key={issue.id}
                onClick={() => handleSelectIssue(issue.id)}
                className={`w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-start gap-2 ${
                  activeIssueId === issue.id ? 'bg-accent' : ''
                }`}
              >
                <CircleDot className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{issue.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {issue.tasks.length} task{issue.tasks.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <Badge variant={STATUS_COLOR[issue.status]} className="text-[10px] shrink-0">
                  {STATUS_LABEL[issue.status]}
                </Badge>
              </button>
            ))}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
