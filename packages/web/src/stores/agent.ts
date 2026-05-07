import { create } from 'zustand';
import type { AgentConfig } from '@agent-spaces/shared';

interface AgentStore {
  agents: AgentConfig[];
  loaded: boolean;
  loading: boolean;
  ensure: () => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  loaded: false,
  loading: false,
  ensure: async () => {
    const { loaded, loading } = get();
    if (loaded || loading) return;

    set({ loading: true });
    try {
      const res = await fetch('/api/agents/presets');
      if (!res.ok) return;
      const data: AgentConfig[] = await res.json();
      set({ agents: data, loaded: true });
    } catch { /* ignore */ }
    finally {
      set({ loading: false });
    }
  },
}));

export function findAgentById(id: string): AgentConfig | undefined {
  return useAgentStore.getState().agents.find((a) => a.id === id);
}
