'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchSelect } from '@/components/ui/search-select';
import { MemberPicker } from '@/components/common/member-picker';
import { getMemberDisplayName } from '@/lib/agent-members';

import type { AgentConfig, Channel } from '@agent-spaces/shared';

interface ChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channel?: Channel | null;
  agents?: AgentConfig[];
  onSubmit: (data: { name: string; type: Channel['type']; members: string[] }) => void;
}

export function ChannelDialog({ open, onOpenChange, channel, agents = [], onSubmit }: ChannelDialogProps) {
  const t = useTranslations('chat');
  const tc = useTranslations('common');
  const channelTypeOptions = [
    { value: 'general', label: t('channel.general') },
    { value: 'issue', label: t('channel.issue') },
    { value: 'agent', label: t('channel.agent') },
  ];
  const [name, setName] = useState('');
  const [type, setType] = useState<Channel['type']>('general');
  const [members, setMembers] = useState<string[]>([]);
  const [dialogKey, setDialogKey] = useState(0);

  const candidates = agents
    .filter((a) => a.enabled !== false)
    .map((a) => ({ id: a.id, label: getMemberDisplayName(agents, a.id) }));

  useEffect(() => {
    if (!open) return;

    queueMicrotask(() => {
      if (channel) {
        setName(channel.name);
        setType(channel.type);
        setMembers([...channel.members]);
      } else {
        setName('');
        setType('general');
        setMembers(['user']);
      }
      setDialogKey((k) => k + 1);
    });
  }, [open, channel]);

  const toggleMember = (id: string) => {
    setMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    onSubmit({ name: name.trim(), type, members });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-4 shrink-0">
          <DialogTitle>{channel ? t('channel.edit') : t('channel.create')}</DialogTitle>
          <DialogDescription>
            {channel ? t('channel.edit') : t('channel.create')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tc('name')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('channel.namePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('channel.type')}</label>
            <SearchSelect
              value={type}
              onChange={(v) => setType(v as Channel['type'])}
              options={channelTypeOptions}
              allowCustom={false}
              placeholder={t('channel.selectType')}
            />
          </div>
          <MemberPicker
            key={dialogKey}
            candidates={candidates}
            selected={members}
            onToggle={toggleMember}
            label={t('channel.members')}
            searchPlaceholder={t('channel.addMember')}
            emptyText={t('channel.noAgents') || 'No agents found'}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
            <Button onClick={handleSubmit}>
              {channel ? tc('save') : tc('create')}
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
