import { FolderOpen, Briefcase, Plus } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useWorkspaceStore } from '../workspace';
import { toStaticHref } from '@/lib/navigate';

export const workspaceSearch: SearchCommandProvider = {
  prefix: 'workspace',
  aliases: ['w', 'ws'],
  label: 'Workspace',
  icon: FolderOpen,
  search: (keyword) => {
    const { workspaces, setCreateDialogOpen } = useWorkspaceStore.getState();
    const lower = keyword.toLowerCase();

    const createItem = {
      id: '__create_workspace__',
      label: '新建 Workspace',
      icon: Plus,
      action: () => setTimeout(() => setCreateDialogOpen(true), 300),
    };

    const filtered = workspaces
      .filter((ws) =>
        ws.name.toLowerCase().includes(lower) ||
        ws.boundDirs.some((d) => d.toLowerCase().includes(lower)),
      )
      .map((ws) => ({
        id: ws.id,
        label: ws.name,
        description: ws.boundDirs[0],
        icon: Briefcase,
        action: () => {
          const href = toStaticHref(`/workspace/${ws.id}`);
          window.location.href = href;
        },
      }));

    return [createItem, ...filtered];
  },
};
