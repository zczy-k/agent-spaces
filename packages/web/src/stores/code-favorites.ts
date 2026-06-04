import { create } from 'zustand';
import { sdk } from '@/lib/sdk';

export type { CodeFavorite } from '@agent-spaces/shared';

export interface PendingFavorite {
  workspaceId: string;
  path: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  label: string;
  snippet: string;
}

interface CodeFavoritesState {
  favorites: CodeFavorite[];
  loadedWorkspaceId: string | null;
  pendingFavorite: PendingFavorite | null;
  load: (workspaceId: string) => Promise<void>;
  addFavorite: (fav: Omit<CodeFavorite, 'id' | 'createdAt'>) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  clearFavorites: (workspaceId: string) => Promise<void>;
  setPendingFavorite: (pending: PendingFavorite | null) => void;
}

import type { CodeFavorite } from '@agent-spaces/shared';

export const useCodeFavoritesStore = create<CodeFavoritesState>((set, get) => ({
  favorites: [],
  loadedWorkspaceId: null,
  pendingFavorite: null,

  load: async (workspaceId) => {
    const { loadedWorkspaceId } = get();
    if (loadedWorkspaceId === workspaceId) return;
    try {
      const favorites = await sdk.codeFavorites.list(workspaceId);
      set({ favorites, loadedWorkspaceId: workspaceId });
    } catch {
      set({ favorites: [], loadedWorkspaceId: workspaceId });
    }
  },

  addFavorite: async (fav) => {
    const { loadedWorkspaceId } = get();
    if (!loadedWorkspaceId) return;
    try {
      const entry = await sdk.codeFavorites.create(loadedWorkspaceId, fav);
      set((s) => ({ favorites: [entry, ...s.favorites] }));
    } catch { /* ignore */ }
  },

  removeFavorite: async (id) => {
    const { loadedWorkspaceId } = get();
    if (!loadedWorkspaceId) return;
    try {
      await sdk.codeFavorites.delete_(loadedWorkspaceId, id);
      set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
    } catch { /* ignore */ }
  },

  clearFavorites: async (workspaceId) => {
    try {
      await sdk.http.delete(`/api/workspaces/${workspaceId}/code-favorites`);
      set({ favorites: [], loadedWorkspaceId: workspaceId });
    } catch { /* ignore */ }
  },

  setPendingFavorite: (pending) => set({ pendingFavorite: pending }),
}));
