// packages/web/src/components/chat/inline-chat-panel.tsx
"use client";

import { Button } from "@/components/ui/button";
import { AgentIcon } from "@/components/common/agent-icon";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Eraser, MessageSquare, PanelRightOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useEffect, useMemo, useState } from "react";
import type { Attachment as MessageAttachment } from "@agent-spaces/shared";
import { ChatComposerInput, type ChatComposerInputHandle } from "./chat-composer-input";
import { ChatMessageBubble } from "./chat-message-bubble";
import type { ChatMessage } from "@agent-spaces/sdk";

interface InlineChatPanelProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  agentIcon?: string;
  agentDescription?: string;
  messages: ChatMessage[];
  sending: boolean;
  error?: string;
  streamingContent?: string;
  streamingThinking?: string;
  workspaceId?: string;
  onSend: (content: string, mentions: string[], attachments: MessageAttachment[], contextLength: number) => void;
  onStop: () => void;
  onClearMessages: (agentId: string) => void;
  onEditAgent: (agentId: string) => void;
  onToggleRightPanel?: () => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  archived?: boolean;
}

export function InlineChatPanel({
  agentId,
  agentName,
  agentAvatar,
  agentIcon,
  agentDescription,
  messages,
  sending,
  error = "",
  streamingContent = "",
  streamingThinking = "",
  workspaceId,
  onSend,
  onStop,
  onClearMessages,
  onEditAgent,
  onToggleRightPanel,
  onRegenerate,
  onDelete,
  archived = false,
}: InlineChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerInputHandle>(null);
  const [selectedVersions, setSelectedVersions] = useState<Record<string, number>>({});
  const [regeneratingVersionKey, setRegeneratingVersionKey] = useState<string | null>(null);
  const [regenerationStartedAt, setRegenerationStartedAt] = useState<string | null>(null);
  const messageItems = useMemo(() => groupMessageVersions(messages), [messages]);
  const t = useTranslations('chat.inlineChat');
  const isRegenerating = sending && regeneratingVersionKey !== null;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, error, streamingContent, streamingThinking]);

  useEffect(() => {
    if (sending) return;
    setRegeneratingVersionKey(null);
    setRegenerationStartedAt(null);
  }, [sending]);

  const handleSend = (
    content: string,
    mentions: string[],
    attachments: MessageAttachment[],
    contextLength: number,
  ) => {
    setRegeneratingVersionKey(null);
    setRegenerationStartedAt(null);
    onSend(content, mentions, attachments, contextLength);
  };

  const createStreamingMessage = (key: string): ChatMessage => ({
    id: `${agentId}:regenerating:${key}`,
    agentId,
    role: "agent",
    content: streamingThinking ? `<think>${streamingThinking}</think>${streamingContent}` : streamingContent,
    timestamp: regenerationStartedAt ?? new Date().toISOString(),
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
          onClick={() => onEditAgent(agentId)}
          type="button"
        >
          <div className="relative flex flex-shrink-0 items-end">
            <AgentIcon agentId={agentId} name={agentName} avatarUrl={agentAvatar} icon={agentIcon} className="size-9" bordered />
            <span className="-bottom-0 absolute right-0 flex items-center">
              <span
                aria-label={sending ? "running" : "idle"}
                className={`inline-block size-2.5 rounded-full border-2 border-background ${sending ? "bg-blue-500 animate-pulse" : "bg-green-500"}`}
              />
            </span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-primary decoration-primary/30 hover:decoration-primary transition-colors">{agentName}</h3>
            <span className="truncate text-xs text-muted-foreground">
              {agentDescription || (sending ? t('typing') : t('online'))}
            </span>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label={t('clearMessages')}
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => onClearMessages(agentId)}
            size="icon"
            variant="ghost"
            type="button"
          >
            <Eraser className="size-4" />
          </Button>
                {onToggleRightPanel && (
            <Button
              aria-label={t('togglePanel')}
              className="size-8 text-muted-foreground"
              onClick={onToggleRightPanel}
              size="icon"
              variant="ghost"
              type="button"
            >
              <PanelRightOpen className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4">
        <div className="flex min-h-full flex-col gap-3">
          {messages.length === 0 && !sending && (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquare />
                </EmptyMedia>
                <EmptyTitle>{t('startConversation')}</EmptyTitle>
                <EmptyDescription>{t('startConversationDesc')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {messageItems.map((item) => {
            if (item.type === "single") {
              return (
                <ChatMessageBubble
                  key={item.message.id}
                  message={item.message}
                  agentId={agentId}
                  agentName={agentName}
                  agentAvatar={agentAvatar}
                  onDelete={onDelete ? () => onDelete(item.message.id) : undefined}
                />
              );
            }

            const streamingMessage = isRegenerating && regeneratingVersionKey === item.key
              ? createStreamingMessage(item.key)
              : null;
            const versionMessages = streamingMessage ? [...item.messages, streamingMessage] : item.messages;
            const selectedIndex = selectedVersions[item.key] ?? versionMessages.length - 1;
            const clampedIndex = Math.min(selectedIndex, versionMessages.length - 1);
            const selectedMessage = versionMessages[clampedIndex];
            if (!selectedMessage) return null;
            const isStreamingVersion = selectedMessage?.id === streamingMessage?.id;

            return (
              <ChatMessageBubble
                key={item.key}
                message={selectedMessage}
                agentId={agentId}
                agentName={agentName}
                agentAvatar={agentAvatar}
                onRegenerate={!sending && onRegenerate ? () => {
                  setRegeneratingVersionKey(item.key);
                  setRegenerationStartedAt(new Date().toISOString());
                  setSelectedVersions((prev) => ({ ...prev, [item.key]: item.messages.length }));
                  onRegenerate(selectedMessage.id);
                } : undefined}
                onDelete={!isStreamingVersion && onDelete ? () => onDelete(selectedMessage.id) : undefined}
                versionIndex={clampedIndex}
                versionCount={versionMessages.length}
                onVersionChange={(index) => setSelectedVersions((prev) => ({ ...prev, [item.key]: index }))}
                isStreaming={isStreamingVersion}
              />
            );
          })}
          {error && (
            <div className="flex gap-3">
              <AgentIcon agentId={agentId} name={agentName} avatarUrl={agentAvatar} icon={agentIcon} className="size-7" bordered />
              <div className="max-w-[78%] rounded-2xl rounded-tl-none border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="font-medium">{t('requestFailed')}</div>
                <div className="mt-1 whitespace-pre-wrap break-words text-xs">{error}</div>
              </div>
            </div>
          )}
          {sending && !isRegenerating && (streamingContent || streamingThinking) && (
            <div className="flex gap-3">
              <AgentIcon agentId={agentId} name={agentName} avatarUrl={agentAvatar} icon={agentIcon} className="size-7" bordered />
              <div className="max-w-[78%] rounded-2xl rounded-tl-none bg-muted/50 px-4 py-3 text-sm">
                {streamingThinking && (
                  <details className="mb-2 rounded-md border border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none font-medium">{t('thinking')}</summary>
                    <div className="mt-2 whitespace-pre-wrap break-words">{streamingThinking}</div>
                  </details>
                )}
                {streamingContent && (
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {streamingContent}
                  </div>
                )}
              </div>
            </div>
          )}
          {sending && !isRegenerating && !streamingContent && !streamingThinking && (
            <div className="flex gap-3">
              <AgentIcon agentId={agentId} name={agentName} avatarUrl={agentAvatar} icon={agentIcon} className="size-7" bordered />
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-none bg-muted/50 px-4 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-foreground/40" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {!archived && (
        <div className="border-t p-3">
          <ChatComposerInput
            ref={composerRef}
            workspaceId={workspaceId || ""}
            agents={[]}
            placeholder={t('messagePlaceholder', { name: agentName })}
            onSubmit={handleSend}
            isProcessing={sending}
            onStop={onStop}
            disableMentionSuggestions
            enableAttachments={false}
            enableVoice={false}
            enableAutoMode={false}
            enableContextControl={false}
            enableSlashCommands={false}
            enableAgentResources={false}
          />
        </div>
      )}
    </div>
  );
}

type MessageRenderItem =
  | { type: "single"; message: ChatMessage }
  | { type: "versions"; key: string; messages: ChatMessage[] };

function groupMessageVersions(messages: ChatMessage[]): MessageRenderItem[] {
  const items: MessageRenderItem[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) continue;

    if (message.role === "user") {
      items.push({ type: "single", message });

      const replies: ChatMessage[] = [];
      let replyIndex = index + 1;
      while (replyIndex < messages.length && messages[replyIndex]?.role === "agent") {
        replies.push(messages[replyIndex]);
        replyIndex += 1;
      }

      if (replies.length > 0) {
        items.push({ type: "versions", key: `${message.id}-replies`, messages: replies });
        index = replyIndex - 1;
      }
      continue;
    }

    const orphanReplies: ChatMessage[] = [message];
    let replyIndex = index + 1;
    while (replyIndex < messages.length && messages[replyIndex]?.role === "agent") {
      orphanReplies.push(messages[replyIndex]);
      replyIndex += 1;
    }
    items.push({ type: "versions", key: message.id, messages: orphanReplies });
    index = replyIndex - 1;
  }

  return items;
}
