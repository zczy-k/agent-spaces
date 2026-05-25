import { create } from 'zustand';
import type { WorktreeInfo, CreateWorktreeInput, Workspace } from '@agent-spaces/shared';
import { fetchWithAuth } from '@/lib/auth';
import { useWorkspaceStore } from './workspace';

interface WorktreeStore {
  worktrees: WorktreeInfo[];
  loading: boolean;
  load: (workspaceId: string) => Promise<void>;
  create: (workspaceId: string, data: CreateWorktreeInput) => Promise<WorktreeInfo>;
  remove: (workspaceId: string, worktreeId: string) => Promise<void>;
  createPR: (workspaceId: string, worktreeId: string, opts?: { title?: string; body?: string }) => Promise<string>;
  merge: (workspaceId: string, worktreeId: string) => Promise<void>;
}

function worktreeToWorkspace(worktree: WorktreeInfo): Workspace {
  return {
    id: worktree.id,
    name: `${worktree.name} (Worktree)`,
    boundDirs: [worktree.path],
    agentspaceDir: `${worktree.path}/.agentspace`,
    isWorktree: true,
    parentWorkspaceId: worktree.workspaceId,
    createdAt: worktree.createdAt,
    updatedAt: worktree.updatedAt,
    activeChannels: [],
    activeIssues: [],
  };
}

function syncWorktreeWorkspaces(parentWorkspaceId: string, worktrees: WorktreeInfo[]) {
  const workspaceStore = useWorkspaceStore.getState();
  const activeWorktrees = worktrees.filter((worktree) => worktree.status === 'active');
  const nextWorktreeIds = new Set(activeWorktrees.map((worktree) => worktree.id));

  workspaceStore.workspaces
    .filter((workspace) =>
      workspace.isWorktree &&
      workspace.parentWorkspaceId === parentWorkspaceId &&
      !nextWorktreeIds.has(workspace.id)
    )
    .forEach((workspace) => workspaceStore.removeWorkspace(workspace.id));

  activeWorktrees.forEach((worktree) => {
    workspaceStore.upsertWorkspace(worktreeToWorkspace(worktree));
  });
}

export const useWorktreeStore = create<WorktreeStore>((set) => ({
  worktrees: [],
  loading: false,

  load: async (workspaceId) => {
    set({ loading: true });
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/worktrees`);
      if (res.ok) {
        const worktrees: WorktreeInfo[] = await res.json();
        set({ worktrees });
        syncWorktreeWorkspaces(workspaceId, worktrees);
      }
    } finally {
      set({ loading: false });
    }
  },

  create: async (workspaceId, data) => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/worktrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const info: WorktreeInfo = await res.json();
    set((s) => ({ worktrees: [...s.worktrees, info] }));
    useWorkspaceStore.getState().upsertWorkspace(worktreeToWorkspace(info));
    return info;
  },

  remove: async (workspaceId, worktreeId) => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/worktrees/${worktreeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    set((s) => ({ worktrees: s.worktrees.filter((wt) => wt.id !== worktreeId) }));
    useWorkspaceStore.getState().removeWorkspace(worktreeId);
  },

  createPR: async (workspaceId, worktreeId, opts) => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/worktrees/${worktreeId}/pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts || {}),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const { prUrl } = await res.json();
    set((s) => ({
      worktrees: s.worktrees.map((wt) =>
        wt.id === worktreeId ? { ...wt, prUrl } : wt
      ),
    }));
    return prUrl;
  },

  merge: async (workspaceId, worktreeId) => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/worktrees/${worktreeId}/merge`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    set((s) => ({
      worktrees: s.worktrees.filter((wt) => wt.id !== worktreeId),
    }));
    useWorkspaceStore.getState().removeWorkspace(worktreeId);
  },
}));
