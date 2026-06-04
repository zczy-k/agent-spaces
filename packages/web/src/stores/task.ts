import { create } from 'zustand';
import type { Task } from '@agent-spaces/shared';
import { sdk } from '@/lib/sdk';

interface TaskStore {
  tasks: Task[];
  loading: boolean;

  loadTasks: (workspaceId: string, issueId?: string) => Promise<void>;
  createTask: (workspaceId: string, issueId: string, title: string, description: string, agentConfigId: string) => Promise<Task>;
  updateTask: (workspaceId: string, taskId: string, data: { title?: string; description?: string; agentConfigId?: string }) => Promise<void>;
  deleteTask: (workspaceId: string, taskId: string) => Promise<void>;
  retryTask: (workspaceId: string, taskId: string) => Promise<void>;
  cancelTask: (workspaceId: string, taskId: string) => Promise<void>;
  reorderTasks: (workspaceId: string, issueId: string, taskIds: string[]) => Promise<void>;

  // WS handlers
  upsertTask: (task: Task) => void;
}

function uniqueTasksById(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  loadTasks: async (workspaceId, issueId) => {
    set({ loading: true });
    try {
      const tasks = await sdk.task.list(workspaceId, issueId);
      set({ tasks: uniqueTasksById(tasks), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createTask: async (workspaceId, issueId, title, description, agentConfigId) => {
    const task = await sdk.task.create(workspaceId, { issueId, title, description, agentConfigId });
    get().upsertTask(task);
    return task;
  },

  updateTask: async (workspaceId, taskId, data) => {
    const task = await sdk.task.update(workspaceId, taskId, data);
    get().upsertTask(task);
  },

  deleteTask: async (workspaceId, taskId) => {
    await sdk.task.delete_(workspaceId, taskId);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  retryTask: async (workspaceId, taskId) => {
    const task = await sdk.task.retry(workspaceId, taskId);
    get().upsertTask(task);
  },

  cancelTask: async (workspaceId, taskId) => {
    const task = await sdk.task.cancel(workspaceId, taskId);
    get().upsertTask(task);
  },

  reorderTasks: async (workspaceId, issueId, taskIds) => {
    await sdk.task.reorder(workspaceId, { issueId, taskIds });
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
