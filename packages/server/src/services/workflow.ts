// packages/server/src/services/workflow.ts
// NOTE: All storage functions are synchronous (matching json-store pattern).
//       Service functions are also synchronous where they only call sync storage.
//       Route handlers wrap in async for Express compatibility.

import { v4 as uuid } from 'uuid';
import type { WorkflowTemplate, WorkflowNode, WorkflowEdge, AgentConfig } from '@agent-spaces/shared';
import * as workflowStore from '../storage/workflow-store.js';
import { getWorkspace } from '../storage/workspace-store.js';
import { listTemplates } from './agent.js';

// --- Legacy node data helpers ---
// In the unified model, node.data is Record<string, unknown>.
// These helpers provide typed access for legacy agent/command nodes.

interface LegacyAgentData {
  label: string;
  agentConfigId: string;
  role: string;
  avatarUrl?: string;
  modelId?: string;
  taskTitleTemplate?: string;
  taskDescriptionTemplate?: string;
}

interface LegacyCommandData {
  label: string;
  script: string;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  failStrategy?: 'stop';
}

function getAgentData(node: WorkflowNode): LegacyAgentData | null {
  if (node.type !== 'agent') return null;
  return node.data as unknown as LegacyAgentData;
}

function getCommandData(node: WorkflowNode): LegacyCommandData | null {
  if (node.type !== 'command') return null;
  return node.data as unknown as LegacyCommandData;
}

function getLabel(node: WorkflowNode): string {
  return (node.data as Record<string, unknown>).label as string || node.label;
}

// --- DAG Validation ---

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] | null {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const source = edge.source;
    const target = edge.target;
    adj.get(source)!.push(target);
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const neighbor of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return result.length === nodes.length ? result : null;
}

function hasDuplicateEdges(edges: WorkflowEdge[]): boolean {
  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function hasSelfLoops(edges: WorkflowEdge[]): boolean {
  return edges.some(e => e.source === e.target);
}

export function validateDAG(template: Pick<WorkflowTemplate, 'nodes' | 'edges'>): string | null {
  if (template.nodes.length === 0) return 'Workflow must have at least one node';
  if (hasSelfLoops(template.edges)) return 'Self-loops are not allowed';
  if (hasDuplicateEdges(template.edges)) return 'Duplicate edges are not allowed';

  const allNodeIds = new Set(template.nodes.map(n => n.id));
  for (const e of template.edges) {
    if (!allNodeIds.has(e.source)) return `Edge references unknown source node: ${e.source}`;
    if (!allNodeIds.has(e.target)) return `Edge references unknown target node: ${e.target}`;
  }

  if (topologicalSort(template.nodes, template.edges) === null) {
    return 'Workflow contains a cycle';
  }

  return null;
}

// --- Role Staleness Resolution ---

function resolveStaleRoles(nodes: WorkflowNode[]): { nodes: WorkflowNode[]; invalidIds: string[] } {
  const agentMap = new Map(listTemplates().map(a => [a.id, a]));
  const invalidIds: string[] = [];

  const resolved = nodes.map(node => {
    if (node.type === 'command') return node;
    const agentData = getAgentData(node);
    if (!agentData) return node;
    const agent = agentMap.get(agentData.agentConfigId);
    if (!agent) {
      invalidIds.push(node.id);
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        role: agent.role,
        avatarUrl: agent.avatarUrl,
        modelId: agent.modelId,
      },
    };
  });

  return { nodes: resolved, invalidIds };
}

// --- CRUD (synchronous) ---

export function listWorkflows(): WorkflowTemplate[] {
  return workflowStore.listWorkflows();
}

export function getWorkflow(workflowId: string): WorkflowTemplate | null {
  return workflowStore.getWorkflow(workflowId);
}

export function createWorkflow(
  input: { name: string; description?: string; nodes?: WorkflowNode[]; edges?: WorkflowEdge[] }
): WorkflowTemplate {
  const now = Date.now();
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];

  const { nodes: resolvedNodes, invalidIds } = resolveStaleRoles(nodes);
  if (invalidIds.length > 0) {
    throw new Error(`Invalid agent references in nodes: ${invalidIds.join(', ')}`);
  }

  const template: WorkflowTemplate = {
    id: uuid(),
    name: input.name,
    folderId: null,
    description: input.description,
    nodes: resolvedNodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };

  const error = validateDAG(template);
  if (error) throw new Error(error);

  workflowStore.createWorkflow(template);
  return template;
}

export function updateWorkflow(
  workflowId: string,
  updates: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'nodes' | 'edges'>>
): WorkflowTemplate {
  const existing = workflowStore.getWorkflow(workflowId);
  if (!existing) throw new Error('Workflow not found');

  let nodes = updates.nodes ?? existing.nodes;

  if (updates.nodes) {
    const resolved = resolveStaleRoles(updates.nodes);
    if (resolved.invalidIds.length > 0) {
      throw new Error(`Invalid agent references in nodes: ${resolved.invalidIds.join(', ')}`);
    }
    nodes = resolved.nodes;
  }

  const updated: WorkflowTemplate = {
    ...existing,
    ...updates,
    nodes,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  if (updates.nodes || updates.edges) {
    const error = validateDAG(updated);
    if (error) throw new Error(error);
  }

  workflowStore.updateWorkflow(updated);
  return updated;
}

export function deleteWorkflow(workflowId: string): void {
  const existing = workflowStore.getWorkflow(workflowId);
  if (!existing) throw new Error('Workflow not found');
  workflowStore.deleteWorkflow(workflowId);
}

export function duplicateWorkflow(workflowId: string): WorkflowTemplate {
  const existing = workflowStore.getWorkflow(workflowId);
  if (!existing) throw new Error('Workflow not found');

  const now = Date.now();
  const duplicated: WorkflowTemplate = {
    ...existing,
    id: uuid(),
    name: `${existing.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  workflowStore.createWorkflow(duplicated);
  return duplicated;
}

// --- Task Mapping ---

export interface TaskDraftForWorkflow {
  key: string;
  title: string;
  description: string;
  agentConfigId?: string;
  dependsOnKeys?: string[];
  sandboxDirs?: string[];
  commandNode?: WorkflowNode;
}

export function mapWorkflowToTaskDrafts(template: WorkflowTemplate): TaskDraftForWorkflow[] {
  const dependsOn = new Map<string, string[]>();
  for (const node of template.nodes) {
    dependsOn.set(node.id, []);
  }
  for (const edge of template.edges) {
    dependsOn.get(edge.target)?.push(edge.source);
  }

  return template.nodes.map(node => {
    const label = getLabel(node);
    if (node.type === 'command') {
      return {
        key: node.id,
        title: label,
        description: `Run command: ${label}`,
        agentConfigId: undefined,
        dependsOnKeys: dependsOn.get(node.id)?.length ? dependsOn.get(node.id) : undefined,
        sandboxDirs: undefined,
        commandNode: node,
      };
    }
    const agentData = getAgentData(node);
    const taskTitle = (agentData?.taskTitleTemplate || label) as string;
    const taskDesc = agentData?.taskDescriptionTemplate || `Task assigned to ${label} (${agentData?.role || 'unknown'})`;
    return {
      key: node.id,
      title: taskTitle,
      description: taskDesc as string,
      agentConfigId: agentData?.agentConfigId,
      dependsOnKeys: dependsOn.get(node.id)?.length ? dependsOn.get(node.id) : undefined,
      sandboxDirs: undefined,
    };
  });
}

// --- Run-time Validation ---

export function validateWorkflowForRun(_workspaceId: string, template: WorkflowTemplate, memberAgentIds: Set<string>): string | null {
  const agentMap = new Map(listTemplates().map((a) => [a.id, a]));

  for (const node of template.nodes) {
    if (node.type === 'command') continue;
    const agentData = getAgentData(node);
    if (!agentData) continue;
    const label = getLabel(node);
    const agent = agentMap.get(agentData.agentConfigId);
    if (!agent) return `Agent "${label}" (${agentData.agentConfigId}) no longer exists`;
    if (!agent.enabled) return `Agent "${agent.name}" is disabled`;
    if (!memberAgentIds.has(agentData.agentConfigId)) return `Agent "${agent.name}" is not in the issue channel members`;
  }

  return null;
}
