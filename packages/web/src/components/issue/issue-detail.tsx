'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { Task, IssueComment } from '@agent-spaces/shared';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  MessageSquare, X, MoreHorizontal, Users, Calendar, Paperclip, Plus,
  ArrowRight, Pencil, Info, MessagesSquare, Play, StepForward, Ban,
  RotateCcw, Check, ArrowLeft, GitBranch,
} from 'lucide-react';
import { useIssueStore } from '@/stores/issue';
import { useMobilePanelStore } from '@/stores/mobile-panel';
import { useTaskStore } from '@/stores/task';
import { useAgentStore } from '@/stores/agent';
import { useChannelStore } from '@/stores/channel';
import { EditIssueDialog } from '@/components/issue/edit-issue-dialog';
import { ChatComposerInput } from '@/components/chat/chat-composer-input';
import { normalizeChannelMembersToAgentIds, getMemberDisplayName } from '@/lib/agent-members';
import { getWS } from '@/lib/ws';
import { cn } from '@/lib/utils';
import { IssueDetailTasksPanel } from './issue-detail-tasks-panel';
import { IssueDetailComments } from './issue-detail-comments';
import { IssueDetailInfoPanel } from './issue-detail-info-panel';
import { CommentNavigator } from './comment-navigator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AgentIcon } from '@/components/common/agent-icon';
import { ISSUE_STATUS_COLOR } from './issue-status-colors';

/* ------------------------------------------------------------------ */
/*  Animation variants (from project-detail-view)                      */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 },
  },
};

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

  // Task dialog state (moved from IssueDetailHeader)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');

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
      if (expanded) next.add(commentId);
      else next.delete(commentId);
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
    commentRefs.current.get(comment.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [comments]);

  // Task dialog handlers (moved from IssueDetailHeader)
  const handleOpenTaskDialog = useCallback(() => {
    setEditingTask(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setSelectedAgentId('');
    setTaskDialogOpen(true);
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!issue || !newTaskTitle.trim() || !selectedAgentId) return;
    if (editingTask) {
      await updateTask(workspaceId, editingTask.id, {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        agentConfigId: selectedAgentId,
      });
    } else {
      await createTask(workspaceId, issue.id, newTaskTitle.trim(), newTaskDesc.trim(), selectedAgentId);
    }
    setNewTaskTitle('');
    setNewTaskDesc('');
    setSelectedAgentId('');
    setEditingTask(null);
    setTaskDialogOpen(false);
  }, [issue, editingTask, newTaskTitle, newTaskDesc, selectedAgentId, workspaceId, updateTask, createTask]);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description);
    setSelectedAgentId(task.agentConfigId ?? '');
    setTaskDialogOpen(true);
  }, []);

  const issueTasks = useMemo(() => {
    if (!issue) return [];
    const filtered = tasks.filter((t) => t.issueId === issue.id);
    const seen = new Set<string>();
    const uniqueTasks = filtered.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
    const taskOrder = issue.tasks ?? [];
    const orderMap = new Map(taskOrder.map((id, idx) => [id, idx]));
    const fallback = taskOrder.length;
    return uniqueTasks.sort((a, b) => (orderMap.get(a.id) ?? fallback) - (orderMap.get(b.id) ?? fallback));
  }, [tasks, issue]);

  const members = Array.from(new Set(issue?.members ?? []));
  const normalizedIssue = issue ? { ...issue, members } : undefined;
  const enabledAgents = useMemo(() => {
    const seen = new Set<string>();
    return agents.filter((agent) => {
      if (agent.enabled === false || seen.has(agent.id)) return false;
      seen.add(agent.id);
      return true;
    });
  }, [agents]);

  if (!issue || !normalizedIssue) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t('detail.selectIssue')}
      </div>
    );
  }

  // Command availability
  const activeTaskStatuses = new Set(['running', 'reviewing', 'retrying', 'waiting_review']);
  const hasActiveTask = issueTasks.some((task) => activeTaskStatuses.has(task.status));
  const hasRunnableTask = issueTasks.some((task) => {
    if (task.status !== 'pending') return false;
    const doneIds = new Set(issueTasks.filter((item) => item.status === 'done').map((item) => item.id));
    return (task.dependsOnTaskIds ?? []).every((id) => doneIds.has(id));
  });
  const canStart = issue.status === 'draft' || issue.status === 'planned';
  const canContinue = !hasActiveTask && hasRunnableTask && issue.status !== 'error' && issue.status !== 'completed' && issue.status !== 'archived';
  const canInterrupt = hasActiveTask || issue.status === 'planned' || issue.status === 'in_progress';

  const statusDotColor = issue.status === 'completed' ? 'bg-green-500'
    : issue.status === 'in_progress' ? 'bg-blue-500'
    : issue.status === 'error' ? 'bg-red-500'
    : 'bg-yellow-500';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        <div className="flex-1 min-h-0 overflow-y-auto">
        <Card className="border-0 shadow-none rounded-none flex flex-col p-0">
          <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col">

            {/* Header Section — project-detail-view CardHeader style */}
            <CardHeader className="shrink-0 p-4 border-b bg-muted/30 space-y-0">
              <motion.div variants={itemVariants} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden shrink-0"
                    onClick={() => useMobilePanelStore.getState().setActivePanel('issue-list')}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <h1 className="text-xl font-bold tracking-tight truncate">{issue.title}</h1>
                  <Badge variant={ISSUE_STATUS_COLOR[issue.status]} className="font-semibold">
                    <span className={`mr-2 h-2 w-2 rounded-full animate-pulse ${statusDotColor}`} />
                    {t(`status.${issue.status}`)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      size="sm"
                      checked={issue.continuousRun !== false}
                      onCheckedChange={(checked) => updateIssue(workspaceId, issue.id, { continuousRun: checked })}
                    />
                    <span>{t('detail.continuousRun')}</span>
                  </div>
                  {canStart && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => startIssue(workspaceId, issue.id)}>
                      <Play className="h-3 w-3 mr-1" />
                      {t('detail.start')}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={!canContinue} onClick={() => continueIssue(workspaceId, issue.id)}>
                    <StepForward className="h-3 w-3 mr-1" />
                    {t('detail.continue')}
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-destructive hover:text-destructive" disabled={!canInterrupt} onClick={() => interruptIssue(workspaceId, issue.id)}>
                    <Ban className="h-3 w-3 mr-1" />
                    {t('detail.interrupt')}
                  </Button>
                  {issue.status === 'error' && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => resumeIssue(workspaceId, issue.id)}>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {t('detail.resumeFailed')}
                    </Button>
                  )}
                  {issue.retryPaused && issue.status === 'error' && (
                    <span className="text-[11px] text-muted-foreground">
                      {t('detail.retryPaused', { failed: issue.retryCount, total: issue.maxRetries })}
                    </span>
                  )}
                  <span className="mx-1 h-4 w-px bg-border" />
                  <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('detail.openChatChannel') as string}
                    onClick={() => { if (issue.channelId) useChannelStore.getState().ensureAndActivateChannel(workspaceId, issue.channelId); }}
                  >
                    <MessagesSquare className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setInfoOpen(true)}>
                    <Info className="size-4" />
                  </Button>
                </div>
              </motion.div>
            </CardHeader>

            {/* Scrollable meta + commands + tasks + attachments */}
            <div className="shrink-0 p-6 pb-2 space-y-5">
              {/* Meta Info Grid — project-detail-view style */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {members.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('detail.memberCount', { count: members.length })}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {members.slice(0, 4).map((member) => (
                          <div key={member} className="flex items-center gap-1">
                            <AgentIcon
                              agentId={member !== 'user' ? member : undefined}
                              name={getMemberDisplayName(enabledAgents, member)}
                              className="size-6 rounded-full"
                            />
                            <span className="font-medium text-xs">{getMemberDisplayName(enabledAgents, member)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">{t('detail.created')}</p>
                    <p className="font-medium text-xs mt-1 flex items-center gap-2">
                      {new Date(issue.createdAt).toLocaleDateString()}
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {new Date(issue.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {issue.branch && (
                  <div className="flex items-start gap-3">
                    <GitBranch className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Branch</p>
                      <p className="font-mono text-xs mt-1">{issue.branch}</p>
                    </div>
                  </div>
                )}
                {issue.description && (
                  <div className="flex items-start gap-3 col-span-1 md:col-span-2">
                    <MoreHorizontal className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('detail.description')}</p>
                      <p className="mt-1 text-foreground/80 whitespace-pre-wrap max-h-40 overflow-y-auto">{issue.description}</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Tasks Section */}
              {tasksLoading ? (
                <motion.div variants={itemVariants}>
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
                </motion.div>
              ) : (
                <motion.div variants={itemVariants}>
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
                    headerAction={
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenTaskDialog}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                </motion.div>
              )}

              {/* Attachments Placeholder — project-detail-view style */}
              <motion.div variants={itemVariants} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                    Attachments
                    <Badge variant="secondary">0</Badge>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Comments — natural height, page-level scroll */}
            <motion.div variants={itemVariants} className="flex flex-col">
              {commentsLoading && comments.length === 0 ? (
                <div className="flex flex-col border-t">
                  <div className="px-4 pt-2">
                    <Skeleton className="h-4 w-20 mb-3" />
                  </div>
                  <div className="px-4 space-y-4">
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
            </motion.div>

          </motion.div>
        </Card>
        </div>

        {/* Floating composer — UNCHANGED */}
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
                enableContextControl={false}
                enableAgentResources={false}
              />
            </div>
          </div>
        )}

        {/* Fixed comment navigator */}
        {comments.length > 0 && (
          <CommentNavigator comments={comments} onNavigate={scrollToComment} />
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

      {/* Task Dialog — moved from IssueDetailHeader */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => { setTaskDialogOpen(open); if (!open) setEditingTask(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? t('detail.editTask') : t('detail.addTask')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('detail.taskTitlePlaceholder') as string}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
            <Textarea
              placeholder={t('detail.taskDescriptionPlaceholder') as string}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              rows={3}
            />
            {enabledAgents.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Agent</label>
                <div className="flex flex-wrap gap-1">
                  {enabledAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors border',
                        selectedAgentId === agent.id ? 'border-primary bg-primary/10 text-primary' : 'border-transparent hover:bg-muted',
                      )}
                    >
                      <AgentIcon agentId={agent.id} name={agent.name} avatarUrl={agent.avatarUrl} apiBase={agent.apiBase} className="size-4 rounded-full" />
                      <span className="truncate max-w-[80px]">{agent.name}</span>
                      {selectedAgentId === agent.id && <Check className="size-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || !selectedAgentId} size="sm">
              {editingTask ? tc('save') : t('detail.addTask')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
