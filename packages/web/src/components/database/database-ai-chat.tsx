'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SendHorizontal, Settings, SlidersHorizontal, Trash2 } from 'lucide-react';
import { FloatingPanel } from '@/components/common/floating-panel';
import { AgentDialog } from '@/components/sidebar/agent-dialog';
import { Markdown } from '@/components/ui/markdown';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  content: string;
};

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
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
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
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: finalMessage || '未收到有效回复。',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          content: err instanceof Error ? err.message : '发送失败。',
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending, workspaceId]);

  return (
    <>
      <FloatingPanel
        id={`database-ai-chat:${workspaceId}`}
        title="数据库会话"
        defaultWidth={420}
        defaultHeight={560}
        minWidth={340}
        minHeight={420}
        onClose={onClose}
        onMinimize={onMinimize}
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-gray-500 dark:text-gray-400"
                  title="设置"
                >
                  <Settings size={14} />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem className="gap-2" onClick={() => setSettingsOpen(true)}>
                <SlidersHorizontal className="size-3.5" />
                <span>模型设置</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setMessages([])}>
                <Trash2 className="size-3.5" />
                <span>清空消息</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div className="flex h-full flex-col bg-background">
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                暂无消息
              </div>
            )}
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[84%] rounded-lg px-3 py-2 text-sm leading-6',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {message.role === 'agent' ? (
                      <Markdown content={message.content} workspaceId={workspaceId} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">思考中...</div>
                </div>
              )}
            </div>
          </div>
          <div className="border-t p-3">
            <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="输入消息"
                className="min-h-9 max-h-28 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                rows={1}
              />
              <Button
                size="icon"
                className="size-9 shrink-0 rounded-full"
                disabled={!input.trim() || sending}
                onClick={() => void sendMessage()}
              >
                <SendHorizontal className="size-4" />
              </Button>
            </div>
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
