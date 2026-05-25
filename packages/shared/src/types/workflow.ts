import type { AgentConfig } from './workspace.js';

export interface WorkflowAgentNode {
  id: string;
  type: 'agent';
  position: { x: number; y: number };
  data: {
    label: string;
    agentConfigId: string;
    role: AgentConfig['role'];
    avatarUrl?: string;
    modelId?: string;
    taskTitleTemplate?: string;
    taskDescriptionTemplate?: string;
  };
}

export interface WorkflowCommandNode {
  id: string;
  type: 'command';
  position: { x: number; y: number };
  data: {
    label: string;
    script: string;
    cwd?: string;
    env?: Record<string, string>;
    shell?: string;
    failStrategy?: 'stop';
  };
}

export type WorkflowNode = WorkflowAgentNode | WorkflowCommandNode;

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}
