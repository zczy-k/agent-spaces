'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useChannelStore } from '@/stores/channel';
import { getWS } from '@/lib/ws';
import { MessageItem } from './message-item';

interface ChatPanelProps {
  workspaceId: string;
}

export function ChatPanel({ workspaceId }: ChatPanelProps) {
  const { activeChannelId, channels, messages, loadMessages, sendMessage, addMessage } = useChannelStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channel = channels.find((c) => c.id === activeChannelId);
  const msgs = activeChannelId ? (messages[activeChannelId] || []) : [];

  // Load messages when active channel changes
  useEffect(() => {
    if (activeChannelId) loadMessages(workspaceId, activeChannelId);
  }, [activeChannelId, workspaceId, loadMessages]);

  // Subscribe to WS messages
  useEffect(() => {
    const ws = getWS(workspaceId);
    const unsub = ws.on('channel.message', (data: unknown) => {
      const msg = data as { channelId: string; id: string };
      if (msg.channelId === activeChannelId) {
        addMessage(msg.channelId, data as any);
      }
    });
    return () => { unsub(); };
  }, [workspaceId, activeChannelId, addMessage]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const handleSend = useCallback(() => {
    const input = inputRef.current;
    if (!input || !activeChannelId || !input.value.trim()) return;
    sendMessage(workspaceId, activeChannelId, input.value.trim());
    input.value = '';
  }, [workspaceId, activeChannelId, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a channel to start chatting
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <span className="text-sm font-semibold"># {channel.name}</span>
        <span className="text-xs text-muted-foreground">{channel.members.length} members</span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {msgs.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t px-4 py-2">
        <input
          ref={inputRef}
          type="text"
          placeholder={`Message #${channel.name}...`}
          className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
