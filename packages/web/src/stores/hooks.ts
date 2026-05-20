import { create } from 'zustand';
import type { HookConfig } from '@agent-spaces/shared';
import { fetchWithAuth } from '@/lib/auth';

interface HookStore {
  hooks: HookConfig[];
  selectedName: string | null;
  loading: boolean;

  fetchHooks: (workspaceId: string) => Promise<void>;
  createHook: (workspaceId: string, name: string) => Promise<void>;
  updateHook: (workspaceId: string, name: string, config: HookConfig) => Promise<void>;
  deleteHook: (workspaceId: string, name: string) => Promise<void>;
  uploadHook: (workspaceId: string, content: string) => Promise<void>;
  applyToWorkspace: (workspaceId: string, name: string, targetWorkspaceId: string) => Promise<void>;
  setSelectedName: (name: string | null) => void;
  reset: () => void;
}

export const useHookStore = create<HookStore>((set) => ({
  hooks: [],
  selectedName: null,
  loading: false,

  fetchHooks: async (workspaceId) => {
    set({ loading: true });
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks`);
      const hooks: HookConfig[] = await res.json();
      set({ hooks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createHook: async (workspaceId, name) => {
    const config: HookConfig = {
      name,
      enabled: true,
      hooks: { PreToolUse: [], PostToolUse: [] },
    };
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    set((s) => ({ hooks: [...s.hooks, config], selectedName: name }));
  },

  updateHook: async (workspaceId, name, config) => {
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    set((s) => ({
      hooks: s.hooks.map((h) => (h.name === name ? config : h)),
    }));
  },

  deleteHook: async (workspaceId, name) => {
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/${name}`, {
      method: 'DELETE',
    });
    set((s) => ({
      hooks: s.hooks.filter((h) => h.name !== name),
      selectedName: s.selectedName === name ? null : s.selectedName,
    }));
  },

  uploadHook: async (workspaceId, content) => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const config: HookConfig = await res.json();
    set((s) => ({ hooks: [...s.hooks, config], selectedName: config.name }));
  },

  applyToWorkspace: async (workspaceId, name, targetWorkspaceId) => {
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/${name}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetWorkspaceId }),
    });
  },

  setSelectedName: (name) => set({ selectedName: name }),

  reset: () => set({ hooks: [], selectedName: null, loading: false }),
}));
