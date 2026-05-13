import { Hash, MessageCircle } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useChannelStore } from '../channel';

export const channelSearch: SearchCommandProvider = {
  prefix: 'channel',
  aliases: ['ch', 'c'],
  label: 'Channel',
  icon: Hash,
  search: (keyword) => {
    const { channels, setActiveChannel } = useChannelStore.getState();
    const lower = keyword.toLowerCase();
    return channels
      .filter((ch) => ch.name.toLowerCase().includes(lower))
      .map((ch) => ({
        id: ch.id,
        label: ch.name,
        description: ch.type,
        icon: MessageCircle,
        action: () => setActiveChannel(ch.id),
      }));
  },
};
