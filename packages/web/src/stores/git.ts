import { create } from 'zustand';
import type { GitStatusResult, GitDiffResult, GitLogEntry } from '@agent-spaces/shared';

interface GitState {
  status: GitStatusResult | null;
  diffs: GitDiffResult[];
  selectedFile: string | null;
  log: GitLogEntry[];
  loading: boolean;
  error: string | null;

  loadStatus: (workspaceId: string) => Promise<void>;
  loadDiffs: (workspaceId: string, filePath?: string) => Promise<void>;
  loadLog: (workspaceId: string) => Promise<void>;
  selectFile: (path: string | null) => void;
}

export const useGitStore = create<GitState>((set) => ({
  status: null,
  diffs: [],
  selectedFile: null,
  log: [],
  loading: false,
  error: null,

  loadStatus: async (workspaceId) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/status`);
      if (!res.ok) throw new Error(await res.text());
      const data: GitStatusResult = await res.json();
      set({ status: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadDiffs: async (workspaceId, filePath) => {
    set({ loading: true });
    try {
      const url = filePath
        ? `/api/workspaces/${workspaceId}/git/diff?path=${encodeURIComponent(filePath)}`
        : `/api/workspaces/${workspaceId}/git/diff`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data: GitDiffResult[] = await res.json();
      set({ diffs: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadLog: async (workspaceId) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/log`);
      if (!res.ok) throw new Error(await res.text());
      const data: GitLogEntry[] = await res.json();
      set({ log: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  selectFile: (path) => set({ selectedFile: path }),
}));
