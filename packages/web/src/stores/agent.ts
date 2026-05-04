import { create } from 'zustand';
import type { AgentConfig } from '@agent-spaces/shared';

interface AgentStore {
  agents: AgentConfig[];
  loadedWorkspaceId?: string;
  loadingWorkspaceId?: string;
  ensure: (workspaceId: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>(() => ({
  agents: [],
  loadedWorkspaceId: undefined,
  loadingWorkspaceId: undefined,
  ensure: async (workspaceId: string) => {
    if (!workspaceId) return;
    const { loadedWorkspaceId, loadingWorkspaceId } = useAgentStore.getState();
    if (loadedWorkspaceId === workspaceId || loadingWorkspaceId === workspaceId) return;

    useAgentStore.setState({ loadingWorkspaceId: workspaceId });
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agents/presets`);
      if (!res.ok) return;
      const data: AgentConfig[] = await res.json();
      useAgentStore.setState({ agents: data, loadedWorkspaceId: workspaceId });
    } catch { /* ignore */ }
    finally {
      const { loadingWorkspaceId } = useAgentStore.getState();
      if (loadingWorkspaceId === workspaceId) {
        useAgentStore.setState({ loadingWorkspaceId: undefined });
      }
    }
  },
}));

export function findAgentById(id: string): AgentConfig | undefined {
  return useAgentStore.getState().agents.find((a) => a.id === id);
}
