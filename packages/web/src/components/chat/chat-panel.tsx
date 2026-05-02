'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useChannelStore } from '@/stores/channel';
import { getWS } from '@/lib/ws';
import { MessageItem } from './message-item';
import { ChatInput } from './chat-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Status, StatusIndicator, StatusLabel } from '@/components/ui/status-badge';
import { Settings, Hash, Bot, AlertCircle, Info, Users } from 'lucide-react';
import type { Channel } from '@agent-spaces/shared';

const channelTypeStatus: Record<Channel['type'], { label: string; status: 'online' | 'offline' | 'maintenance' | 'degraded' }> = {
  general: { label: 'General', status: 'online' },
  issue: { label: 'Issue', status: 'degraded' },
  agent: { label: 'Agent', status: 'maintenance' },
};

interface ChatPanelProps {
  workspaceId: string;
}

export function ChatPanel({ workspaceId }: ChatPanelProps) {
  const { activeChannelId, channels, messages, loadMessages, sendMessage, addMessage } = useChannelStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const channel = channels.find((c) => c.id === activeChannelId);
  const msgs = activeChannelId ? (messages[activeChannelId] || []) : [];

  useEffect(() => {
    if (activeChannelId) loadMessages(workspaceId, activeChannelId);
  }, [activeChannelId, workspaceId, loadMessages]);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const handleSend = useCallback((content: string) => {
    if (!activeChannelId) return;
    sendMessage(workspaceId, activeChannelId, content);
  }, [workspaceId, activeChannelId, sendMessage]);

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a channel to start chatting
      </div>
    );
  }

  const typeConf = channelTypeStatus[channel.type];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <span className="text-sm font-semibold"># {channel.name}</span>
        <Status status={typeConf.status}>
          <StatusIndicator />
          <StatusLabel>{typeConf.label}</StatusLabel>
        </Status>
        <span className="text-xs text-muted-foreground">{channel.members.length} members</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="size-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {msgs.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput channelName={channel.name} onSend={handleSend} />

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>频道设置</DialogTitle>
            <DialogDescription>管理频道信息和成员</DialogDescription>
            <div className="flex gap-1 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => document.getElementById('channel-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Info className="size-3" />频道信息
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => document.getElementById('channel-members')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Users className="size-3" />成员管理
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 px-4 pb-4">
            {/* 频道信息 */}
            <section id="channel-info" className="space-y-3 pb-6">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Info className="size-3.5 text-muted-foreground" />频道信息
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-10 rounded-lg bg-muted">
                  {channel.type === 'agent' ? <Bot className="size-5 text-muted-foreground" /> :
                   channel.type === 'issue' ? <AlertCircle className="size-5 text-muted-foreground" /> :
                   <Hash className="size-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium">#{channel.name}</p>
                  <p className="text-xs text-muted-foreground">类型：{typeConf.label}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">频道 ID</span>
                  <span className="font-mono text-xs">{channel.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">成员数</span>
                  <span>{channel.members.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">创建时间</span>
                  <span>{new Date(channel.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </section>

            {/* 成员管理 */}
            <section id="channel-members" className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" />成员管理
                <span className="text-xs text-muted-foreground font-normal">({channel.members.length})</span>
              </h4>
              <div className="space-y-1">
                {channel.members.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">暂无成员</p>
                )}
                {channel.members.map((member) => (
                  <div key={member} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted">
                    <div className="flex items-center justify-center size-7 rounded-full bg-muted text-xs font-medium">
                      {member[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm">{member}</span>
                  </div>
                ))}
              </div>
            </section>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
