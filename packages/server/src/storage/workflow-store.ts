// packages/server/src/storage/workflow-store.ts
// NOTE: All functions are synchronous to match json-store.ts and issue-store.ts patterns

import type { WorkflowTemplate } from '@agent-spaces/shared';
import { ensureDir, readJsonFile, writeJsonFile, deleteFile, getDataDir } from './json-store.js';
import path from 'node:path';

function workflowsDir(workspaceId: string) {
  return path.join(getDataDir(), 'workspaces', workspaceId, 'workflows');
}

function workflowsIndex(workspaceId: string) {
  return path.join(workflowsDir(workspaceId), 'index.json');
}

function workflowFile(workspaceId: string, workflowId: string) {
  return path.join(workflowsDir(workspaceId), `${workflowId}.json`);
}

export function listWorkflows(workspaceId: string): WorkflowTemplate[] {
  return readJsonFile<WorkflowTemplate[]>(workflowsIndex(workspaceId)) ?? [];
}

export function getWorkflow(workspaceId: string, workflowId: string): WorkflowTemplate | null {
  return readJsonFile<WorkflowTemplate>(workflowFile(workspaceId, workflowId));
}

export function createWorkflow(workspaceId: string, workflow: WorkflowTemplate): void {
  ensureDir(workflowsDir(workspaceId));
  writeJsonFile(workflowFile(workspaceId, workflow.id), workflow);
  const index = listWorkflows(workspaceId);
  index.push(workflow);
  writeJsonFile(workflowsIndex(workspaceId), index);
}

export function updateWorkflow(workspaceId: string, workflow: WorkflowTemplate): void {
  writeJsonFile(workflowFile(workspaceId, workflow.id), workflow);
  const index = listWorkflows(workspaceId);
  const idx = index.findIndex(w => w.id === workflow.id);
  if (idx !== -1) index[idx] = workflow;
  writeJsonFile(workflowsIndex(workspaceId), index);
}

export function deleteWorkflow(workspaceId: string, workflowId: string): void {
  deleteFile(workflowFile(workspaceId, workflowId));
  const index = listWorkflows(workspaceId);
  writeJsonFile(workflowsIndex(workspaceId), index.filter(w => w.id !== workflowId));
}
