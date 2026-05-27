import { Hash, MessageCircle, Plus } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useChannelStore } from '../channel';

export const channelSearch: SearchCommandProvider = {
  prefix: 'channel',
  aliases: ['ch', 'c'],
  label: 'Channel',
  icon: Hash,
  search: (keyword) => {
    const { channels, setActiveChannel, setCreateDialogOpen } = useChannelStore.getState();
    const lower = keyword.toLowerCase();

    const createItem = {
      id: '__create_channel__',
      label: '新建频道',
      icon: Plus,
      action: () => setTimeout(() => setCreateDialogOpen(true), 300),
    };

    const filtered = channels
      .filter((ch) => ch.name.toLowerCase().includes(lower))
      .map((ch) => ({
        id: ch.id,
        label: ch.name,
        description: ch.type,
        icon: MessageCircle,
        action: () => setActiveChannel(ch.id),
      }));

    return [createItem, ...filtered];
  },
};
