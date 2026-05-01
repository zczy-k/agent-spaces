import { create } from 'zustand';
import type { Task, TaskStatus } from '@agent-spaces/shared';

interface TaskStore {
  tasks: Task[];
  loading: boolean;

  loadTasks: (workspaceId: string, issueId?: string) => Promise<void>;
  retryTask: (workspaceId: string, taskId: string) => Promise<void>;
  cancelTask: (workspaceId: string, taskId: string) => Promise<void>;

  // WS handlers
  upsertTask: (task: Task) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  loadTasks: async (workspaceId, issueId) => {
    set({ loading: true });
    try {
      const params = issueId ? `?issueId=${issueId}` : '';
      const res = await fetch(`/api/workspaces/${workspaceId}/tasks${params}`);
      const tasks: Task[] = await res.json();
      set({ tasks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  retryTask: async (workspaceId, taskId) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${taskId}/retry`, {
      method: 'POST',
    });
    const task: Task = await res.json();
    get().upsertTask(task);
  },

  cancelTask: async (workspaceId, taskId) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    const task: Task = await res.json();
    get().upsertTask(task);
  },

  upsertTask: (task) => {
    set((s) => {
      const idx = s.tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        const copy = [...s.tasks];
        copy[idx] = task;
        return { tasks: copy };
      }
      return { tasks: [...s.tasks, task] };
    });
  },
}));
