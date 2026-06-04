// Workflow REST API client — delegates to @agent-spaces/sdk

import type {
  Workflow, WorkflowFolder, WorkflowVersion, ExecutionLog, OperationEntry, StagedNode, WorkflowNode, WorkflowEdge, WorkflowAgentChatMessage,
} from '@agent-spaces/shared';
import { sdk } from './sdk';

// ---- Workflow CRUD ----

export const workflowApi = {
  list(folderId?: string | null): Promise<Workflow[]> {
    return sdk.workflow.list(folderId);
  },

  get(id: string): Promise<Workflow> {
    return sdk.workflow.get(id);
  },

  create(data: Partial<Workflow>): Promise<Workflow> {
    return sdk.workflow.create(data);
  },

  update(id: string, data: Partial<Workflow>): Promise<Workflow> {
    return sdk.workflow.update(id, data);
  },

  delete(id: string): Promise<void> {
    return sdk.workflow.delete_(id);
  },

  duplicate(id: string): Promise<Workflow> {
    return sdk.workflow.duplicate(id);
  },

  execute(
    workflowId: string,
    input?: Record<string, unknown>,
    snapshot?: { nodes: WorkflowNode[]; edges: Workflow['edges']; groups?: Workflow['groups'] },
    startNodeId?: string,
  ) {
    return { event: 'workflow:execute' as const, data: { workflowId, input, snapshot, startNodeId } };
  },
};

// ---- Folders ----

export const workflowFolderApi = {
  list(): Promise<WorkflowFolder[]> {
    return sdk.workflow.listFolders();
  },
  create(data: Partial<WorkflowFolder>): Promise<WorkflowFolder> {
    return sdk.workflow.createFolder(data);
  },
  update(id: string, data: Partial<WorkflowFolder>): Promise<WorkflowFolder> {
    return sdk.workflow.updateFolder(id, data);
  },
  delete(id: string): Promise<void> {
    return sdk.workflow.deleteFolder(id);
  },
};

// ---- Versions ----

export const workflowVersionApi = {
  list(workflowId: string): Promise<WorkflowVersion[]> {
    return sdk.workflow.listVersions(workflowId);
  },
  add(workflowId: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): Promise<WorkflowVersion> {
    return sdk.workflow.addVersion(workflowId, { name, nodes, edges });
  },
  get(workflowId: string, versionId: string): Promise<WorkflowVersion> {
    return sdk.workflow.getVersion(workflowId, versionId);
  },
  delete(workflowId: string, versionId: string): Promise<void> {
    return sdk.workflow.deleteVersion(workflowId, versionId);
  },
  clear(workflowId: string): Promise<void> {
    return sdk.workflow.clearVersions(workflowId);
  },
};

// ---- Execution Logs ----

export const executionLogApi = {
  listAll(limit = 50): Promise<(ExecutionLog & { workflowName?: string })[]> {
    return sdk.workflow.listAllExecutionLogs(limit);
  },
  list(workflowId: string): Promise<ExecutionLog[]> {
    return sdk.workflow.listExecutionLogs(workflowId);
  },
  get(workflowId: string, logId: string): Promise<ExecutionLog> {
    return sdk.workflow.getExecutionLog(workflowId, logId);
  },
  delete(workflowId: string, logId: string): Promise<void> {
    return sdk.workflow.deleteExecutionLog(workflowId, logId);
  },
  clear(workflowId: string): Promise<void> {
    return sdk.workflow.clearExecutionLogs(workflowId);
  },
};

// ---- Operation History ----

export const operationHistoryApi = {
  load(workflowId: string): Promise<OperationEntry[]> {
    return sdk.workflow.loadOperationHistory(workflowId);
  },
  save(workflowId: string, entries: OperationEntry[]): Promise<void> {
    return sdk.workflow.saveOperationHistory(workflowId, entries);
  },
  clear(workflowId: string): Promise<void> {
    return sdk.workflow.clearOperationHistory(workflowId);
  },
};

// ---- Staging ----

export const stagingApi = {
  load(workflowId: string): Promise<StagedNode[]> {
    return sdk.workflow.loadStaging(workflowId);
  },
  save(workflowId: string, nodes: StagedNode[]): Promise<void> {
    return sdk.workflow.saveStaging(workflowId, nodes);
  },
  clear(workflowId: string): Promise<void> {
    return sdk.workflow.clearStaging(workflowId);
  },
};

// ---- Workflow Agent Chat ----

export const workflowChatApi = {
  load(workflowId: string): Promise<WorkflowAgentChatMessage[]> {
    return sdk.workflow.loadChat(workflowId);
  },
  save(workflowId: string, messages: WorkflowAgentChatMessage[]): Promise<void> {
    return sdk.workflow.saveChat(workflowId, messages);
  },
  clear(workflowId: string): Promise<void> {
    return sdk.workflow.clearChat(workflowId);
  },
};
