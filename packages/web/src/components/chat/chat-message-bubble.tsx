// packages/web/src/components/chat/chat-message-bubble.tsx
"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Copy, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ChatMessage } from "@agent-spaces/sdk";
import { Markdown } from "@/components/ui/markdown";

function extractThinkingContent(content: string): { thinking: string | null; message: string } {
  const match = content.match(/^<think\s*>([\s\S]*?)<\/think>\s*([\s\S]*)$/);
  if (match) return { thinking: match[1].trim(), message: match[2].trim() };
  return { thinking: null, message: content };
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  agentId?: string;
  agentName: string;
  agentAvatar?: string;
  className?: string;
  onDelete?: () => void;
  onRegenerate?: () => void;
  versionIndex?: number;
  versionCount?: number;
  onVersionChange?: (index: number) => void;
}

export function ChatMessageBubble({
  message,
  agentId: _agentId,
  agentName: _agentName,
  agentAvatar: _agentAvatar,
  className,
  onDelete,
  onRegenerate,
  versionIndex = 0,
  versionCount = 1,
  onVersionChange,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations('chat.messageBubble');
  const { thinking, message: text } =
    message.role === "agent" ? extractThinkingContent(message.content) : { thinking: null, message: message.content };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text || message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const isUser = message.role === "user";
  const hasVersions = !isUser && versionCount > 1 && onVersionChange;
  const versionNumber = Math.min(versionIndex + 1, versionCount);

  return (
    <div className={cn("flex gap-3 group/msg", isUser && "flex-row-reverse", className)}>
      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "px-3 py-2 text-sm leading-relaxed",
            isUser
              ? "rounded-2xl rounded-tr-none bg-primary text-primary-foreground"
              : "rounded-2xl rounded-tl-none bg-muted/50"
          )}
        >
          {thinking && (
            <details className="mb-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">{t('thinking')}</summary>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{thinking}</pre>
            </details>
          )}
          <Markdown content={text} />
        </div>
        <div className={cn("flex items-center gap-1", isUser && "flex-row-reverse")}>
          <span className="text-[10px] text-muted-foreground/60">{formatTime(message.timestamp)}</span>
          {hasVersions && (
            <div className="flex items-center gap-0.5 rounded border border-border/70 bg-background px-0.5">
              <button
                type="button"
                onClick={() => onVersionChange(Math.max(0, versionIndex - 1))}
                disabled={versionIndex <= 0}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                title={t('previousVersion')}
                aria-label={t('previousVersion')}
              >
                <ChevronLeft className="size-3" />
              </button>
              <span className="min-w-8 text-center text-[10px] tabular-nums text-muted-foreground">
                {versionNumber} / {versionCount}
              </span>
              <button
                type="button"
                onClick={() => onVersionChange(Math.min(versionCount - 1, versionIndex + 1))}
                disabled={versionIndex >= versionCount - 1}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                title={t('nextVersion')}
                aria-label={t('nextVersion')}
              >
                <ChevronRight className="size-3" />
              </button>
            </div>
          )}
          {!isUser && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t('regenerate')}
              aria-label={t('regenerate')}
            >
              <RefreshCw className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/msg:opacity-100"
            title={copied ? t('copied') : t('copy')}
          >
            <Copy className="size-3" />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/msg:opacity-100"
              title={t('delete')}
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
