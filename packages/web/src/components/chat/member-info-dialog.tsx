'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { UserMinus } from 'lucide-react';
import { useChannelStore } from '@/stores/channel';
import { MemberInfoCard } from './member-info-card';

interface MemberInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  displayName?: string;
  channelId: string;
  workspaceId: string;
  channels?: string[];
}

export function MemberInfoDialog({ open, onOpenChange, memberName, displayName, channelId, workspaceId, channels = [] }: MemberInfoDialogProps) {
  const [removing, setRemoving] = useState(false);
  const { channels: allChannels, updateChannel } = useChannelStore();

  const channel = allChannels.find((c) => c.id === channelId);
  const isMember = channel?.members.includes(memberName);

  const handleRemove = async () => {
    if (!channel || !isMember) return;
    setRemoving(true);
    try {
      const latestChannel = useChannelStore.getState().channels.find((c) => c.id === channelId) ?? channel;
      const members = latestChannel.members.filter((m) => m !== memberName);
      useChannelStore.setState((state) => ({
        channels: state.channels.map((item) => (
          item.id === channelId ? { ...item, members } : item
        )),
      }));
      await updateChannel(workspaceId, channelId, { members });
      onOpenChange(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>成员信息</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <MemberInfoCard agentId={memberName} displayName={displayName} channels={channels} />
        {isMember && memberName !== 'user' && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center justify-center gap-2 w-full mt-2 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <UserMinus className="size-4" />
            {removing ? '移除中...' : '从频道移除'}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
