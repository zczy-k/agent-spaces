'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SendHorizontal, Settings, SlidersHorizontal, Trash2 } from 'lucide-react';
import { FloatingPanel } from '@/components/common/floating-panel';
import { AgentDialog } from '@/components/sidebar/agent-dialog';
import { Markdown } from '@/components/ui/markdown';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
};

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 560;
const PANEL_MARGIN = 24;
const FLOATING_BALL_CLEARANCE = 88;

function getInitialPanelPosition() {
  if (typeof window === 'undefined') {
    return { x: PANEL_MARGIN, y: PANEL_MARGIN };
  }
  return {
    x: Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN),
    y: Math.max(PANEL_MARGIN, window.innerHeight - PANEL_HEIGHT - FLOATING_BALL_CLEARANCE),
  };
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface DatabaseAiChatProps {
  workspaceId: string;
  onClose: () => void;
  onMinimize: () => void;
}

export function DatabaseAiChat({ workspaceId, onClose, onMinimize }: DatabaseAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/database/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json() as { finalMessage?: string; error?: string };
      const finalMessage = res.ok ? data.finalMessage : data.error;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'agent', content: finalMessage || '未收到有效回复。', timestamp: new Date() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'agent', content: err instanceof Error ? err.message : '发送失败。', timestamp: new Date() },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, workspaceId]);

  return (
    <>
      <style>{`
        @keyframes db-chat-dot {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .db-chat-dot { animation: db-chat-dot 1.4s infinite ease-in-out; }
      `}</style>
      <FloatingPanel
        id={`database-ai-chat:${workspaceId}`}
        title=""
        defaultWidth={PANEL_WIDTH}
        defaultHeight={PANEL_HEIGHT}
        defaultPosition={getInitialPanelPosition()}
        minWidth={340}
        minHeight={420}
        onClose={onClose}
        onMinimize={onMinimize}
      >
        <div className="flex h-full flex-col bg-card">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="relative">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-foreground">
                AI
              </span>
              <span
                aria-hidden="true"
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">Database Agent</div>
              <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="size-1 rounded-full bg-emerald-500" aria-hidden="true" />
                {sending ? 'typing…' : 'online'}
              </div>
            </div>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger
                render={
                  <button
                    className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground cursor-pointer"
                    title="设置"
                  >
                    <Settings size={14} />
                  </button>
                }
              />
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={6}
                positionerClassName="z-[100002]"
                className="w-36 gap-1 p-1"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>模型设置</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setMessages([]);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  <span>清空消息</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>

          {/* Messages */}
          <ol ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/10 px-4 py-5">
            {messages.length === 0 && !sending && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                暂无消息
              </div>
            )}
            {messages.map((message) => (
              <li
                key={message.id}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl',
                    message.role === 'user'
                      ? 'rounded-br-sm bg-foreground text-background'
                      : 'rounded-bl-sm bg-muted text-foreground',
                  )}
                >
                  {message.role === 'agent' ? (
                    <Markdown content={message.content} workspaceId={workspaceId} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  <div
                    className={cn(
                      'mt-1 text-right font-mono text-[10px]',
                      message.role === 'user' ? 'text-background/60' : 'text-muted-foreground',
                    )}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </li>
            ))}
            {sending && (
              <li className="flex justify-start" aria-label="AI is typing">
                <div className="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl rounded-bl-sm bg-muted text-foreground">
                  <div className="flex items-center gap-1" role="status" aria-label="typing">
                    <span className="db-chat-dot size-1.5 rounded-full bg-muted-foreground/70" />
                    <span className="db-chat-dot size-1.5 rounded-full bg-muted-foreground/70" style={{ animationDelay: '0.15s' }} />
                    <span className="db-chat-dot size-1.5 rounded-full bg-muted-foreground/70" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </li>
            )}
          </ol>

          {/* Input */}
          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border bg-background px-3 py-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="回复 Database Agent…"
                className="min-h-6 max-h-28 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                rows={1}
              />
            </div>
            <button
              type="button"
              aria-label="发送消息"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              disabled={!input.trim() || sending}
              onClick={() => void sendMessage()}
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </FloatingPanel>
      <AgentDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialAgentId="database-agent"
        presetBasePath={`/api/workspaces/${workspaceId}/database/agent-presets`}
        singleAgent
      />
    </>
  );
}
