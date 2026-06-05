// packages/web/src/components/chat/inline-chat-panel.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, Square } from "lucide-react";
import { useRef, useEffect } from "react";
import { ChatMessageBubble } from "./chat-message-bubble";
import type { ChatMessage } from "@agent-spaces/sdk";

interface InlineChatPanelProps {
  agentName: string;
  agentAvatar?: string;
  messages: ChatMessage[];
  sending: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export function InlineChatPanel({
  agentName,
  agentAvatar,
  messages,
  sending,
  input,
  onInputChange,
  onSend,
  onStop,
}: InlineChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Avatar className="size-9 border-2 border-background">
          {agentAvatar && <AvatarImage src={agentAvatar} alt={agentName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {agentName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-sm font-semibold">{agentName}</h3>
          <span className="text-xs text-muted-foreground">
            {sending ? "typing..." : "online"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && !sending && (
            <p className="py-12 text-center text-xs text-muted-foreground">
              Start a conversation
            </p>
          )}
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} agentName={agentName} />
          ))}
          {sending && (
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
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (sending) { onStop(); return; }
            onSend();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            className="h-10 flex-1 rounded-full border border-border/40 bg-background/50 px-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
          <Button
            type="submit"
            size={sending ? "sm" : "icon"}
            className={cn(
              "h-10 cursor-pointer rounded-full shadow-lg transition-transform hover:scale-105",
              sending
                ? "w-auto gap-1.5 bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90"
                : "w-10 bg-primary text-primary-foreground"
            )}
            disabled={!sending && !input.trim()}
          >
            {sending ? (
              <>
                <Square className="size-3.5 fill-current" />
                <span className="text-xs font-medium">Stop</span>
              </>
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
