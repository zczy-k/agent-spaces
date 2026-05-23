'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AgentIcon } from '@/components/common/agent-icon';
import { useAgentStore } from '@/stores/agent';
import { useChannelStore } from '@/stores/channel';
import { useUserAvatar } from '@/hooks/use-user-avatar';
import type { IssueComment, MessageReply } from '@agent-spaces/shared';

interface IssueMessageProps {
  comment: IssueComment;
  expanded: boolean;
  workspaceId: string;
  replies?: MessageReply[];
  replying?: boolean;
  onDelete: (commentId: string) => void;
  onUpdate: (workspaceId: string, commentId: string, content: string) => void;
  onExpandedChange?: (commentId: string, expanded: boolean) => void;
  onReplyStart?: (commentId: string) => void;
  onReplyCancel?: () => void;
  onReplySubmit?: (commentId: string, content: string) => void;
}

export function IssueMessage({
  comment,
  expanded,
  workspaceId,
  replies = [],
  replying = false,
  onDelete,
  onUpdate,
  onExpandedChange,
  onReplyStart,
  onReplyCancel,
  onReplySubmit,
}: IssueMessageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [replyDraft, setReplyDraft] = useState('');
  const [repliesExpanded, setRepliesExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isUser = comment.senderId === 'user';
  const agents = useAgentStore((s) => s.agents);
  const agent = !isUser ? agents.find((a) => a.id === comment.senderId) : undefined;
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const loadMessages = useChannelStore((s) => s.loadMessages);
  const linkedChannelId = comment.metadata?.channelId;
  const linkedMessageId = comment.metadata?.messageId;
  const phase = comment.metadata?.phase;
  const taskId = comment.metadata?.taskId;

  const t = useTranslations('issue');
  const tc = useTranslations('common');

  useEffect(() => {
    setDraft(comment.content);
    setEditing(false);
  }, [comment.id, comment.content]);

  useEffect(() => {
    if (replying) {
      replyInputRef.current?.focus();
    } else {
      setReplyDraft('');
    }
  }, [replying]);

  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setOverflowing(el.scrollHeight > 300);
    }
  }, [comment.content, expanded]);

  const senderName = isUser ? tc('you') : (agent?.name || comment.senderId);
  const userAvatarUrl = useUserAvatar();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft.length]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(comment.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleOpenMessage = async () => {
    if (!linkedChannelId || !linkedMessageId) return;
    setActiveChannel(linkedChannelId);
    await loadMessages(workspaceId, linkedChannelId);
    window.setTimeout(() => {
      document.getElementById(`msg-${linkedMessageId}`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 80);
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.content) {
      setEditing(false);
      setDraft(comment.content);
      return;
    }
    onUpdate(workspaceId, comment.id, trimmed);
    setEditing(false);
  };

  const handleReplySubmit = () => {
    const content = replyDraft.trim();
    if (!content) return;
    onReplySubmit?.(comment.id, content);
    setReplyDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setDraft(comment.content);
    }
  };

  const replyable = Boolean(onReplySubmit && linkedMessageId);
  const visibleMetadata = [
    comment.senderRole,
    comment.metadata?.model,
    phase?.replace('_', ' '),
    taskId ? t('message.task', { taskId: taskId.slice(0, 8) }) : undefined,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="group p-4">
      <div className="flex gap-3">
        <AgentIcon
          agentId={isUser ? undefined : comment.senderId}
          name={senderName}
          avatarUrl={isUser ? userAvatarUrl || undefined : undefined}
          className="size-7 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{senderName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {visibleMetadata.map((item) => (
              <Badge key={item} variant="secondary" className="h-4 px-1.5 text-[10px]">
                {item}
              </Badge>
            ))}
          </div>
          {editing ? (
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="mt-2 w-full min-h-[70px] resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <div className="relative">
              <div
                ref={contentRef}
                className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words ${!expanded ? 'max-h-[300px] overflow-hidden' : ''}`}
              >
                {comment.content}
              </div>
              {overflowing && !expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent flex items-end justify-center pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onExpandedChange?.(comment.id, true);
                    }}
                  >
                    {t('message.expandMore')}
                  </Button>
                </div>
              )}
              {expanded && overflowing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 mt-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onExpandedChange?.(comment.id, false);
                  }}
                >
                  {t('message.collapse')}
                </Button>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {replyable ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => onReplyStart?.(comment.id)}
              >
                <MessageCircle className="size-3" />
                回复
              </Button>
            ) : null}
            {replies.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setRepliesExpanded((current) => !current)}
              >
                {repliesExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                {repliesExpanded ? '隐藏' : '显示'} {replies.length} 条回复
              </Button>
            ) : null}
            {linkedChannelId && linkedMessageId ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={handleOpenMessage}
              >
                <ExternalLink className="size-3" />
                {t('message.openMessage')}
              </Button>
            ) : null}
            {!editing && (
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(true); setDraft(comment.content); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(comment.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {replying ? (
            <div className="relative pl-8 pt-3">
              <div className="absolute left-4 top-0 h-full w-px bg-border" />
              <div className="rounded-md border bg-background p-2">
                <textarea
                  ref={replyInputRef}
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleReplySubmit();
                    }
                    if (event.key === 'Escape') {
                      onReplyCancel?.();
                    }
                  }}
                  placeholder="回复此消息"
                  className="min-h-[64px] w-full resize-none bg-transparent text-sm outline-none"
                />
                <div className="mt-2 flex justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onReplyCancel}>
                    <X className="size-3" />
                    取消
                  </Button>
                  <Button size="sm" className="h-7 gap-1 px-2 text-xs" disabled={!replyDraft.trim()} onClick={handleReplySubmit}>
                    <Send className="size-3" />
                    发送
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {repliesExpanded && replies.length > 0 ? (
            <div className="space-y-0">
              {replies.map((reply) => (
                <IssueReply key={reply.id} reply={reply} level={1} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IssueReply({ reply, level }: { reply: MessageReply; level: number }) {
  const tc = useTranslations('common');
  const agents = useAgentStore((s) => s.agents);
  const userAvatarUrl = useUserAvatar();
  const isUser = reply.senderId === 'user';
  const agent = !isUser ? agents.find((item) => item.id === reply.senderId) : undefined;
  const senderName = isUser ? tc('you') : (agent?.name || reply.senderRole || reply.senderId);

  return (
    <div className="relative pl-8 pt-3">
      <div className="absolute left-4 top-0 h-full w-px bg-border" />
      <div className="flex gap-3">
        <AgentIcon
          agentId={isUser ? undefined : reply.senderId}
          name={senderName}
          avatarUrl={isUser ? userAvatarUrl || undefined : undefined}
          className="size-7 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{senderName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">L{level}</Badge>
            {reply.senderRole ? (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{reply.senderRole}</Badge>
            ) : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {stripHtml(reply.content)}
          </p>
        </div>
      </div>
    </div>
  );
}

function stripHtml(content: string): string {
  return /<[a-z][\s\S]*>/i.test(content) ? content.replace(/<[^>]*>/g, '') : content;
}
