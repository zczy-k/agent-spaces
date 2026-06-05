// packages/web/src/components/chat/chat-message-bubble.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useState } from "react";

interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  thinking?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

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
  agentName: string;
  className?: string;
}

export function ChatMessageBubble({ message, agentName, className }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const { thinking, message: text } =
    message.role === "agent" ? extractThinkingContent(message.content) : { thinking: null, message: message.content };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text || message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 group/msg", isUser && "flex-row-reverse", className)}>
      <Avatar className="size-7 shrink-0 border border-border/40">
        <AvatarFallback
          className={cn(
            "text-xs font-semibold",
            isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}
        >
          {isUser ? "ME" : agentName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser && "items-end")}>
        <span className="text-xs font-medium text-muted-foreground">
          {isUser ? "You" : agentName}
        </span>
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
              <summary className="cursor-pointer text-xs text-muted-foreground">Thinking...</summary>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{thinking}</pre>
            </details>
          )}
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
        <div className={cn("flex items-center gap-1", isUser && "flex-row-reverse")}>
          <span className="text-[10px] text-muted-foreground/60">{formatTime(message.timestamp)}</span>
          <button
            onClick={handleCopy}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/msg:opacity-100"
            title={copied ? "Copied" : "Copy"}
          >
            <Copy className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
