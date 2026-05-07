import { create } from 'zustand';
import type { WorkflowTemplate, WorkflowNode, WorkflowEdge } from '@agent-spaces/shared';

interface WorkflowStore {
  workflows: WorkflowTemplate[];
  currentWorkflow: WorkflowTemplate | null;
  isLoading: boolean;

  loadWorkflows: (workspaceId: string) => Promise<void>;
  createWorkflow: (workspaceId: string, data: { name: string; description?: string; nodes?: WorkflowNode[]; edges?: WorkflowEdge[] }) => Promise<WorkflowTemplate>;
  updateWorkflow: (workspaceId: string, id: string, data: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'nodes' | 'edges' | 'viewport'>>) => Promise<void>;
  deleteWorkflow: (workspaceId: string, id: string) => Promise<void>;
  duplicateWorkflow: (workspaceId: string, id: string) => Promise<void>;
  setCurrentWorkflow: (workflow: WorkflowTemplate | null) => void;
  upsertWorkflow: (workflow: WorkflowTemplate) => void;
  removeWorkflow: (id: string) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  isLoading: false,

  loadWorkflows: async (workspaceId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/workflows`);
      const workflows: WorkflowTemplate[] = await res.json();
      set({ workflows, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createWorkflow: async (workspaceId, data) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const workflow: WorkflowTemplate = await res.json();
    set(state => ({ workflows: [...state.workflows, workflow] }));
    return workflow;
  },

  updateWorkflow: async (workspaceId, id, data) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const workflow: WorkflowTemplate = await res.json();
    get().upsertWorkflow(workflow);
  },

  deleteWorkflow: async (workspaceId, id) => {
    await fetch(`/api/workspaces/${workspaceId}/workflows/${id}`, { method: 'DELETE' });
    get().removeWorkflow(id);
  },

  duplicateWorkflow: async (workspaceId, id) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/workflows/${id}/duplicate`, {
      method: 'POST',
    });
    const workflow: WorkflowTemplate = await res.json();
    set(state => ({ workflows: [...state.workflows, workflow] }));
  },

  setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),

  upsertWorkflow: (workflow) => {
    set(state => {
      const idx = state.workflows.findIndex(w => w.id === workflow.id);
      if (idx !== -1) {
        const updated = [...state.workflows];
        updated[idx] = workflow;
        return { workflows: updated };
      }
      return { workflows: [...state.workflows, workflow] };
    });
  },

  removeWorkflow: (id) => {
    set(state => ({
      workflows: state.workflows.filter(w => w.id !== id),
      currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
    }));
  },
}));
