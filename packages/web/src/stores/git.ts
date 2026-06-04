import { create } from 'zustand';
import type { GitStatusResult, GitDiffResult, GitLogEntry, GitBranch } from '@agent-spaces/shared';
import { sdk } from '@/lib/sdk';

interface GitState {
  status: GitStatusResult | null;
  diffs: GitDiffResult[];
  selectedFile: string | null;
  log: GitLogEntry[];
  branches: GitBranch[];
  loading: boolean;
  error: string | null;
  notGitRepo: boolean;
  commitMsg: string;

  loadStatus: (workspaceId: string) => Promise<void>;
  loadDiffs: (workspaceId: string, filePath?: string) => Promise<void>;
  loadLog: (workspaceId: string) => Promise<void>;
  loadBranches: (workspaceId: string) => Promise<void>;
  initRepo: (workspaceId: string) => Promise<void>;
  commit: (workspaceId: string, message: string) => Promise<void>;
  discard: (workspaceId: string, filePath: string) => Promise<void>;
  discardAll: (workspaceId: string) => Promise<void>;
  stage: (workspaceId: string, filePath: string) => Promise<void>;
  unstage: (workspaceId: string, filePath: string) => Promise<void>;
  resolveFile: (workspaceId: string, filePath: string, content: string, stage?: boolean) => Promise<void>;
  checkout: (workspaceId: string, branch: string) => Promise<void>;
  push: (workspaceId: string) => Promise<void>;
  pull: (workspaceId: string) => Promise<void>;
  fetchRemote: (workspaceId: string) => Promise<void>;
  getRemotes: (workspaceId: string) => Promise<{ name: string; refs: { fetch: string; push: string } }[]>;
  addRemote: (workspaceId: string, name: string, url: string) => Promise<void>;
  selectFile: (path: string | null) => void;
  setCommitMsg: (msg: string) => void;
  checkoutDetached: (workspaceId: string, commitHash: string) => Promise<void>;
  cherryPick: (workspaceId: string, commitHash: string) => Promise<void>;
  createBranch: (workspaceId: string, name: string, startPoint?: string) => Promise<void>;
  deleteBranch: (workspaceId: string, name: string, force?: boolean) => Promise<void>;
  createTag: (workspaceId: string, name: string, commitHash?: string) => Promise<void>;
  getCommitDiff: (workspaceId: string, hash: string) => Promise<GitDiffResult[]>;
  getRemoteUrl: (workspaceId: string) => Promise<string | null>;
  getMergeBase: (workspaceId: string) => Promise<string>;
  resetToCommit: (workspaceId: string, commitHash: string, mode?: 'soft' | 'mixed' | 'hard') => Promise<void>;
}

const GIT_NOT_REPO_PATTERN = /not a git repository/i;

function isNotGitRepoError(err: unknown): boolean {
  return err instanceof Error && GIT_NOT_REPO_PATTERN.test(err.message);
}

export const useGitStore = create<GitState>((set) => ({
  status: null,
  diffs: [],
  selectedFile: null,
  log: [],
  branches: [],
  loading: false,
  error: null,
  notGitRepo: false,
  commitMsg: '',

  loadStatus: async (workspaceId) => {
    try {
      const data = await sdk.git.status(workspaceId);
      set({ status: data, notGitRepo: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, notGitRepo: isNotGitRepoError(err) });
    }
  },

  loadDiffs: async (workspaceId, filePath) => {
    set({ loading: true });
    try {
      const data = await sdk.git.diff(workspaceId, filePath);
      set({ diffs: data, loading: false, notGitRepo: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, loading: false, notGitRepo: isNotGitRepoError(err) });
    }
  },

  loadLog: async (workspaceId) => {
    try {
      const data = await sdk.git.log(workspaceId);
      set({ log: data, notGitRepo: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, notGitRepo: isNotGitRepoError(err) });
    }
  },

  loadBranches: async (workspaceId) => {
    try {
      const data = await sdk.git.branches(workspaceId);
      set({ branches: data, notGitRepo: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, notGitRepo: isNotGitRepoError(err) });
    }
  },

  initRepo: async (workspaceId) => {
    try {
      await sdk.git.init(workspaceId);
      set({ error: null, notGitRepo: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  commit: async (workspaceId, message) => {
    try {
      await sdk.git.commit(workspaceId, message);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  discard: async (workspaceId, filePath) => {
    try {
      await sdk.git.discard(workspaceId, filePath);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  discardAll: async (workspaceId) => {
    try {
      await sdk.git.discardAll(workspaceId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  stage: async (workspaceId, filePath) => {
    try {
      await sdk.git.stage(workspaceId, filePath);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  unstage: async (workspaceId, filePath) => {
    try {
      await sdk.git.unstage(workspaceId, filePath);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  resolveFile: async (workspaceId, filePath, content, stage = true) => {
    await sdk.git.resolveFile(workspaceId, { path: filePath, content, stage });
  },

  checkout: async (workspaceId, branch) => {
    try {
      await sdk.git.checkout(workspaceId, branch);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  push: async (workspaceId) => {
    await sdk.git.push(workspaceId);
  },

  pull: async (workspaceId) => {
    await sdk.git.pull(workspaceId);
  },

  fetchRemote: async (workspaceId) => {
    await sdk.git.fetch(workspaceId);
  },

  getRemotes: async (workspaceId) => {
    return sdk.git.remotes(workspaceId);
  },

  addRemote: async (workspaceId, name, url) => {
    await sdk.git.addRemote(workspaceId, name, url);
  },

  selectFile: (path) => set({ selectedFile: path }),
  setCommitMsg: (msg) => set({ commitMsg: msg }),

  checkoutDetached: async (workspaceId, commitHash) => {
    await sdk.git.checkoutDetached(workspaceId, commitHash);
  },

  cherryPick: async (workspaceId, commitHash) => {
    await sdk.git.cherryPick(workspaceId, commitHash);
  },

  createBranch: async (workspaceId, name, startPoint) => {
    await sdk.git.createBranch(workspaceId, name, startPoint);
  },

  deleteBranch: async (workspaceId, name, force) => {
    await sdk.git.deleteBranch(workspaceId, name, force);
  },

  createTag: async (workspaceId, name, commitHash) => {
    await sdk.git.createTag(workspaceId, name, commitHash);
  },

  getCommitDiff: async (workspaceId, hash) => {
    return sdk.git.commitDiff(workspaceId, hash);
  },

  getRemoteUrl: async (workspaceId) => {
    return sdk.git.remoteUrl(workspaceId);
  },

  getMergeBase: async (workspaceId) => {
    return sdk.git.mergeBase(workspaceId);
  },

  resetToCommit: async (workspaceId, commitHash, mode = 'mixed') => {
    await sdk.git.reset(workspaceId, { commitHash, mode });
  },
}));
