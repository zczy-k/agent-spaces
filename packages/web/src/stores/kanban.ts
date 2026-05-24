import { create } from 'zustand';
import { fetchWithAuth } from '@/lib/auth';
import { getWS } from '@/lib/ws';
import type { KanbanBoard, KanbanColumn, KanbanTask } from '@agent-spaces/shared';

interface KanbanState {
  board: KanbanBoard | null;
  loading: boolean;
  wsAttached: boolean;
  load: (workspaceId: string) => Promise<void>;
  save: (workspaceId: string) => Promise<void>;
  setBoard: (board: KanbanBoard) => void;
  updateLayoutMode: (workspaceId: string, layoutMode: string) => void;
  updateColumns: (workspaceId: string, columns: KanbanColumn[]) => void;
  updateTasks: (workspaceId: string, tasks: KanbanTask[]) => void;
  attachWS: (workspaceId: string) => void;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  board: null,
  loading: false,
  wsAttached: false,

  load: async (workspaceId: string) => {
    set({ loading: true });
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/kanban`);
      if (res.ok) {
        const board = await res.json();
        set({ board, loading: false });
      }
    } catch { /* ignore */ }
    set({ loading: false });
  },

  save: async (workspaceId: string) => {
    const { board } = get();
    if (!board) return;
    try {
      await fetchWithAuth(`/api/workspaces/${workspaceId}/kanban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: board.columns, tasks: board.tasks, layoutMode: board.layoutMode, title: board.title }),
      });
    } catch { /* ignore */ }
  },

  setBoard: (board) => set({ board }),

  updateLayoutMode: (workspaceId, layoutMode) => {
    const { board } = get();
    if (!board) return;
    const updated = { ...board, layoutMode: layoutMode as KanbanBoard['layoutMode'] };
    set({ board: updated });
    get().save(workspaceId);
  },

  updateColumns: (workspaceId, columns) => {
    const { board } = get();
    if (!board) return;
    set({ board: { ...board, columns } });
    get().save(workspaceId);
  },

  updateTasks: (workspaceId, tasks) => {
    const { board } = get();
    if (!board) return;
    set({ board: { ...board, tasks } });
    get().save(workspaceId);
  },

  attachWS: (workspaceId: string) => {
    if (get().wsAttached) return;
    const ws = getWS(workspaceId);

    ws.on('kanban.updated', (data) => {
      set({ board: data as KanbanBoard });
    });

    ws.on('kanban.deleted', () => {
      set({ board: null });
    });

    set({ wsAttached: true });
  },
}));
