import { create } from 'zustand';
import type { HookConfig } from '@agent-spaces/shared';
import { sdk } from '@/lib/sdk';

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
      const hooks: HookConfig[] = await sdk.hooks.list(workspaceId);
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
    await sdk.hooks.create(workspaceId, config);
    set((s) => ({ hooks: [...s.hooks, config], selectedName: name }));
  },

  updateHook: async (workspaceId, name, config) => {
    await sdk.hooks.update(workspaceId, name, config);
    set((s) => ({
      hooks: s.hooks.map((h) => (h.name === name ? config : h)),
    }));
  },

  deleteHook: async (workspaceId, name) => {
    await sdk.hooks.delete_(workspaceId, name);
    set((s) => ({
      hooks: s.hooks.filter((h) => h.name !== name),
      selectedName: s.selectedName === name ? null : s.selectedName,
    }));
  },

  uploadHook: async (workspaceId, content) => {
    const config: HookConfig = await sdk.hooks.upload(workspaceId, content);
    set((s) => ({ hooks: [...s.hooks, config], selectedName: config.name }));
  },

  applyToWorkspace: async (workspaceId, name, targetWorkspaceId) => {
    await sdk.hooks.applyToWorkspace(workspaceId, name, targetWorkspaceId);
  },

  setSelectedName: (name) => set({ selectedName: name }),

  reset: () => set({ hooks: [], selectedName: null, loading: false }),
}));
