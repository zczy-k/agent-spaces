// packages/web/src/components/chat/inline-chat-panel.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Eraser, MessageSquare, PanelRightOpen } from "lucide-react";
import { useRef, useEffect } from "react";
import type { Attachment as MessageAttachment } from "@agent-spaces/shared";
import { ChatComposerInput, type ChatComposerInputHandle } from "./chat-composer-input";
import { ChatMessageBubble } from "./chat-message-bubble";
import type { ChatMessage } from "@agent-spaces/sdk";

interface InlineChatPanelProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string;
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
}

export function InlineChatPanel({
  agentId,
  agentName,
  agentAvatar,
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
}: InlineChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerInputHandle>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, error, streamingContent, streamingThinking]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
          onClick={() => onEditAgent(agentId)}
          type="button"
        >
          <Avatar className="size-9 border-2 border-background">
            {agentAvatar && <AvatarImage src={agentAvatar} alt={agentName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {agentName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-base font-semibold text-primary decoration-primary/30 hover:decoration-primary transition-colors">{agentName}</h3>
            <span className="text-xs text-muted-foreground">
              {sending ? "typing..." : "online"}
            </span>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Clear messages"
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
              aria-label="Toggle right panel"
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
                <EmptyTitle>Start a conversation</EmptyTitle>
                <EmptyDescription>Send a message to begin chatting with this agent</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} agentId={agentId} agentName={agentName} agentAvatar={agentAvatar} />
          ))}
          {error && (
            <div className="flex gap-3">
              <Avatar className="size-7 border border-border/40">
                <AvatarFallback className="bg-destructive/10 text-destructive text-xs">
                  {agentName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[78%] rounded-2xl rounded-tl-none border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="font-medium">Request failed</div>
                <div className="mt-1 whitespace-pre-wrap break-words text-xs">{error}</div>
              </div>
            </div>
          )}
          {sending && (streamingContent || streamingThinking) && (
            <div className="flex gap-3">
              <Avatar className="size-7 border border-border/40">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {agentName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[78%] rounded-2xl rounded-tl-none bg-muted/50 px-4 py-3 text-sm">
                {streamingThinking && (
                  <details className="mb-2 rounded-md border border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none font-medium">Thinking</summary>
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
          {sending && !streamingContent && !streamingThinking && (
            <div className="flex gap-3">
              <Avatar className="size-7 border border-border/40">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {agentName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
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
      <div className="border-t p-3">
        <ChatComposerInput
          ref={composerRef}
          workspaceId={workspaceId || ""}
          agents={[]}
          placeholder={`Message ${agentName}...`}
          onSubmit={onSend}
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
    </div>
  );
}
