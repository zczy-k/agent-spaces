'use client';

import { useCallback, useState } from 'react';
import { Settings, SlidersHorizontal, Trash2 } from 'lucide-react';
import { FloatingChatPanel, type ChatMessage } from '@/components/ui/floating-chat-widget';
import { AgentDialog } from '@/components/sidebar/agent-dialog';
import { sdk } from '@/lib/sdk';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatabaseAiChatProps {
  workspaceId: string;
  onClose: () => void;
  onMinimize: () => void;
}

export function DatabaseAiChat({ workspaceId, onClose, onMinimize }: DatabaseAiChatProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const data = await sdk.http.post<{ finalMessage?: string; error?: string }>(
        `/api/workspaces/${workspaceId}/database/chat`,
        {
          message: content,
          history: messages.map(({ role, content }) => ({ role, content })),
        },
      );
      const finalMessage = data.finalMessage || '未收到有效回复。';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'agent', content: finalMessage, timestamp: new Date() },
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

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  return (
    <>
      <FloatingChatPanel
        isOpen={isOpen}
        onClose={handleClose}
        agent={{
          name: 'Database Agent',
          role: sending ? 'typing…' : 'online',
          status: 'online',
        }}
        messages={messages}
        sending={sending}
        input={input}
        onInputChange={setInput}
        onSend={sendMessage}
        onDeleteMessage={(messageId) => {
          setMessages((prev) => prev.filter((message) => message.id !== messageId));
        }}
        inputPlaceholder="回复 Database Agent…"
        markdown
        workspaceId={workspaceId}
        headerActions={
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger
              render={
                <button
                  className="p-1 rounded-full hover:bg-background/50 transition-colors text-muted-foreground cursor-pointer"
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
        }
      />
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
