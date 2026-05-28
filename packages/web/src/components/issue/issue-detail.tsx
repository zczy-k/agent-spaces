'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { Task, IssueComment } from '@agent-spaces/shared';
import { useTranslations } from 'next-intl';
import { useIssueStore } from '@/stores/issue';
import { useMobilePanelStore } from '@/stores/mobile-panel';
import { useTaskStore } from '@/stores/task';
import { useAgentStore } from '@/stores/agent';
import { EditIssueDialog } from '@/components/issue/edit-issue-dialog';
import { ChatComposerInput } from '@/components/chat/chat-composer-input';
import { normalizeChannelMembersToAgentIds } from '@/lib/agent-members';
import { getWS } from '@/lib/ws';
import { IssueDetailHeader, type IssueDetailHeaderRef } from './issue-detail-header';
import { IssueDetailTasksPanel } from './issue-detail-tasks-panel';
import { IssueDetailComments } from './issue-detail-comments';
import { IssueDetailInfoPanel } from './issue-detail-info-panel';
import { MessageSquare, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  IssueDetail                                                        */
/* ------------------------------------------------------------------ */

interface IssueDetailProps {
  workspaceId: string;
}

export function IssueDetail({ workspaceId }: IssueDetailProps) {
  const { issues, activeIssueId, startIssue, resumeIssue, continueIssue, interruptIssue, updateIssue, deleteIssue } = useIssueStore();
  const { tasks, loading: tasksLoading, loadTasks, retryTask, cancelTask, createTask, updateTask, deleteTask, reorderTasks } = useTaskStore();
  const agents = useAgentStore((s) => s.agents);
  const ensureAgents = useAgentStore((s) => s.ensure);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(() => new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const commentsViewportRef = useRef<HTMLDivElement | null>(null);
  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const headerRef = useRef<IssueDetailHeaderRef>(null);

  const handleEditTask = useCallback((task: Task) => {
    headerRef.current?.openEditDialog(task);
  }, []);

  const t = useTranslations('issue');
  const tTask = useTranslations('task');
  const tc = useTranslations('common');

  const issue = issues.find((i) => i.id === activeIssueId);

  const loadComments = useCallback(async (targetIssueId: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/issues/${targetIssueId}/comments`);
      if (!res.ok) return;
      const nextComments: IssueComment[] = await res.json();
      setComments(nextComments);
    } finally {
      setCommentsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (issue) {
      loadTasks(workspaceId, issue.id);
      void Promise.resolve().then(() => loadComments(issue.id));
    }
  }, [issue, workspaceId, loadTasks, loadComments]);

  useEffect(() => {
    ensureAgents();
  }, [ensureAgents]);

  useEffect(() => {
    if (!issue) return;
    const ws = getWS(workspaceId);
    const issueId = issue.id;
    const unsubIssueUpdated = ws.on('issue.updated', (data: unknown) => {
      const updatedIssue = data as { id?: string };
      if (updatedIssue.id === issueId) loadComments(issueId);
    });
    return () => { unsubIssueUpdated(); };
  }, [issue, workspaceId, loadComments]);

  const handleSendComment = useCallback(async (content: string, mentions: string[]) => {
    if (!issue) return;
    const text = content.trim();
    if (!text) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/issues/${issue.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, mentions }),
    });
    if (!res.ok) return;
    const comment: IssueComment = await res.json();
    setComments((current) => [...current, comment]);
    setTimeout(() => {
      commentsViewportRef.current?.scrollTo({
        top: commentsViewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  }, [issue, workspaceId]);

  const handleAddMembers = async (newMembers: string[]) => {
    if (!issue) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/issues/${issue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        members: normalizeChannelMembersToAgentIds(enabledAgents, [...members, ...newMembers]),
      }),
    });
    const updated = await res.json();
    useIssueStore.getState().upsertIssue(updated);
  };

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!issue) return;
    await fetch(`/api/workspaces/${workspaceId}/issues/${issue.id}/comments/${commentId}`, { method: 'DELETE' });
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }, [issue, workspaceId]);

  const handleCommentExpandedChange = useCallback((commentId: string, expanded: boolean) => {
    setExpandedCommentIds((current) => {
      const next = new Set(current);
      if (expanded) {
        next.add(commentId);
      } else {
        next.delete(commentId);
      }
      return next;
    });
  }, []);

  const handleUpdateComment = useCallback(async (wsId: string, commentId: string, content: string) => {
    if (!issue) return;
    const res = await fetch(`/api/workspaces/${wsId}/issues/${issue.id}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return;
    const updated: IssueComment = await res.json();
    setComments((current) => current.map((comment) => (comment.id === updated.id ? updated : comment)));
  }, [issue]);

  const scrollToComment = useCallback((index: number) => {
    const comment = comments[index];
    if (!comment) return;
    commentRefs.current.get(comment.id)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
  }, [comments]);

  const issueTasks = useMemo(() => {
    if (!issue) return [];
    const filtered = tasks.filter((t) => t.issueId === issue.id);
    const taskOrder = issue.tasks ?? [];
    const orderMap = new Map(taskOrder.map((id, idx) => [id, idx]));
    const fallback = taskOrder.length;
    return filtered.sort((a, b) => (orderMap.get(a.id) ?? fallback) - (orderMap.get(b.id) ?? fallback));
  }, [tasks, issue]);
  const members = Array.from(new Set(issue?.members ?? []));
  const normalizedIssue = issue ? { ...issue, members } : undefined;
  const enabledAgents = agents.filter((agent) => agent.enabled !== false);

  if (!issue || !normalizedIssue) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t('detail.selectIssue')}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        <IssueDetailHeader
          ref={headerRef}
          issue={normalizedIssue}
          workspaceId={workspaceId}
          t={t}
          tc={tc}
          setEditOpen={setEditOpen}
          setInfoOpen={setInfoOpen}
          startIssue={startIssue}
          resumeIssue={resumeIssue}
          continueIssue={continueIssue}
          interruptIssue={interruptIssue}
          members={members}
          enabledAgents={enabledAgents}
          issueTasks={issueTasks}
          updateIssue={updateIssue}
          createTask={createTask}
          updateTask={updateTask}
        />

        {tasksLoading ? (
          <div className="shrink-0 p-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="size-6 rounded" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="rounded-md border px-3 py-2 min-w-[140px] space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <IssueDetailTasksPanel
            issue={normalizedIssue}
            workspaceId={workspaceId}
            issueTasks={issueTasks}
            t={t}
            tTask={tTask}
            retryTask={retryTask}
            cancelTask={cancelTask}
            reorderTasks={reorderTasks}
            deleteTask={deleteTask}
            onEditTask={handleEditTask}
          />
        )}

        {commentsLoading && comments.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col border-t">
            <div className="shrink-0 px-4 pt-2">
              <Skeleton className="h-4 w-20 mb-3" />
            </div>
            <div className="flex-1 overflow-auto px-4 space-y-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-6 rounded-full shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <IssueDetailComments
            issue={normalizedIssue}
            workspaceId={workspaceId}
            comments={comments}
            expandedCommentIds={expandedCommentIds}
            commentsViewportRef={commentsViewportRef}
            commentRefs={commentRefs}
            onDeleteComment={handleDeleteComment}
            onUpdateComment={handleUpdateComment}
            onExpandedChange={handleCommentExpandedChange}
            scrollToComment={scrollToComment}
            t={t}
          />
        )}

        {/* Floating composer */}
        {!composerOpen ? (
          <button
            onClick={() => setComposerOpen(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all z-10 cursor-pointer"
          >
            <MessageSquare className="size-4" />
            <span className="text-sm font-medium">{t('detail.comment')}</span>
          </button>
        ) : (
          <div className="absolute bottom-4 left-4 right-4 z-10 animate-in slide-in-from-bottom-2 duration-200">
            <div className="relative">
              <button
                onClick={() => setComposerOpen(false)}
                className="absolute -top-2 -right-2 z-20 size-6 rounded-full bg-muted border shadow-sm flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
              <ChatComposerInput
                workspaceId={workspaceId}
                agents={enabledAgents}
                placeholder={t('detail.commentPlaceholder')}
                onSubmit={(content, mentions) => handleSendComment(content, mentions)}
                enableAutoMode={false}
                enableAgentResources={false}
              />
            </div>
          </div>
        )}
      </div>

      <IssueDetailInfoPanel
        issue={normalizedIssue}
        workspaceId={workspaceId}
        open={infoOpen}
        onOpenChange={setInfoOpen}
        issueTasks={issueTasks}
        members={members}
        enabledAgents={enabledAgents}
        onAddMembers={handleAddMembers}
        onDeleteIssue={() => { deleteIssue(workspaceId, issue.id); useMobilePanelStore.getState().setActivePanel('issue-list'); }}
        t={t}
      />

      {issue && (
        <EditIssueDialog
          issue={normalizedIssue}
          open={editOpen}
          onOpenChange={setEditOpen}
          agents={enabledAgents}
          onSave={async (data) => {
            await updateIssue(workspaceId, issue.id, data);
          }}
        />
      )}
    </div>
  );
}
