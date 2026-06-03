// Workflow REST API client for agent-spaces
// Adapted from workfox's wsBridge-based backend-api to use fetch

import type {
  Workflow, WorkflowFolder, WorkflowVersion, ExecutionLog, OperationEntry, StagedNode, WorkflowNode,
} from '@agent-spaces/shared';
import { fetchWithAuth } from './auth';

// ---- Workflow CRUD ----

export const workflowApi = {
  list(folderId?: string | null): Promise<Workflow[]> {
    const params = folderId ? `?folderId=${folderId}` : '';
    return fetchWithAuth(`/api/workflows${params}`).then(r => r.json());
  },

  get(id: string): Promise<Workflow> {
    return fetchWithAuth(`/api/workflows/${id}`).then(r => r.json());
  },

  create(data: Partial<Workflow>): Promise<Workflow> {
    return fetchWithAuth('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());
  },

  update(id: string, data: Partial<Workflow>): Promise<Workflow> {
    return fetchWithAuth(`/api/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());
  },

  delete(id: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${id}`, { method: 'DELETE' }).then(() => {});
  },

  duplicate(id: string): Promise<Workflow> {
    return fetchWithAuth(`/api/workflows/${id}/duplicate`, { method: 'POST' }).then(r => r.json());
  },

  execute(
    workflowId: string,
    input?: Record<string, unknown>,
    snapshot?: { nodes: WorkflowNode[]; edges: Workflow['edges']; groups?: Workflow['groups'] },
    startNodeId?: string,
  ) {
    // Execution uses WebSocket, not REST — this returns the WS event name and data
    return { event: 'workflow:execute' as const, data: { workflowId, input, snapshot, startNodeId } };
  },
};

// ---- Folders ----

export const workflowFolderApi = {
  list(): Promise<WorkflowFolder[]> {
    return fetchWithAuth('/api/workflows/folders').then(r => r.json());
  },
  create(data: Partial<WorkflowFolder>): Promise<WorkflowFolder> {
    return fetchWithAuth('/api/workflows/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());
  },
  update(id: string, data: Partial<WorkflowFolder>): Promise<WorkflowFolder> {
    return fetchWithAuth(`/api/workflows/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());
  },
  delete(id: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/folders/${id}`, { method: 'DELETE' }).then(() => {});
  },
};

// ---- Versions ----

export const workflowVersionApi = {
  list(workflowId: string): Promise<WorkflowVersion[]> {
    return fetchWithAuth(`/api/workflows/${workflowId}/versions`).then(r => r.json());
  },
  add(workflowId: string, name: string, nodes: WorkflowNode[], edges: unknown[]): Promise<WorkflowVersion> {
    return fetchWithAuth(`/api/workflows/${workflowId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nodes, edges }),
    }).then(r => r.json());
  },
  get(workflowId: string, versionId: string): Promise<WorkflowVersion> {
    return fetchWithAuth(`/api/workflows/${workflowId}/versions/${versionId}`).then(r => r.json());
  },
  delete(workflowId: string, versionId: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/versions/${versionId}`, { method: 'DELETE' }).then(() => {});
  },
  clear(workflowId: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/versions`, { method: 'DELETE' }).then(() => {});
  },
};

// ---- Execution Logs ----

export const executionLogApi = {
  listAll(limit = 50): Promise<(ExecutionLog & { workflowName?: string })[]> {
    return fetchWithAuth(`/api/workflows/execution-logs/all?limit=${limit}`).then(r => r.json());
  },
  list(workflowId: string): Promise<ExecutionLog[]> {
    return fetchWithAuth(`/api/workflows/${workflowId}/execution-logs`).then(r => r.json());
  },
  get(workflowId: string, logId: string): Promise<ExecutionLog> {
    return fetchWithAuth(`/api/workflows/${workflowId}/execution-logs/${logId}`).then(r => r.json());
  },
  delete(workflowId: string, logId: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/execution-logs/${logId}`, { method: 'DELETE' }).then(() => {});
  },
  clear(workflowId: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/execution-logs`, { method: 'DELETE' }).then(() => {});
  },
};

// ---- Operation History ----

export const operationHistoryApi = {
  load(workflowId: string): Promise<OperationEntry[]> {
    return fetchWithAuth(`/api/workflows/${workflowId}/operation-history`).then(r => r.json());
  },
  save(workflowId: string, entries: OperationEntry[]): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/operation-history`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    }).then(() => {});
  },
  clear(workflowId: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/operation-history`, { method: 'DELETE' }).then(() => {});
  },
};

// ---- Staging ----

export const stagingApi = {
  load(workflowId: string): Promise<StagedNode[]> {
    return fetchWithAuth(`/api/workflows/${workflowId}/staging`).then(r => r.json());
  },
  save(workflowId: string, nodes: StagedNode[]): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/staging`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes }),
    }).then(() => {});
  },
  clear(workflowId: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${workflowId}/staging`, { method: 'DELETE' }).then(() => {});
  },
};
