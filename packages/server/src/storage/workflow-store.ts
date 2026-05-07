// packages/server/src/storage/workflow-store.ts
// NOTE: All functions are synchronous to match json-store.ts and issue-store.ts patterns

import type { WorkflowTemplate } from '@agent-spaces/shared';
import { ensureDir, readJsonFile, writeJsonFile, deleteFile, getDataDir } from './json-store.js';
import path from 'node:path';

function workflowsDir() {
  return path.join(getDataDir(), 'workflows');
}

function workflowsIndex() {
  return path.join(workflowsDir(), 'index.json');
}

function workflowFile(workflowId: string) {
  return path.join(workflowsDir(), `${workflowId}.json`);
}

export function listWorkflows(): WorkflowTemplate[] {
  return readJsonFile<WorkflowTemplate[]>(workflowsIndex()) ?? [];
}

export function getWorkflow(workflowId: string): WorkflowTemplate | null {
  return readJsonFile<WorkflowTemplate>(workflowFile(workflowId));
}

export function createWorkflow(workflow: WorkflowTemplate): void {
  ensureDir(workflowsDir());
  writeJsonFile(workflowFile(workflow.id), workflow);
  const index = listWorkflows();
  index.push(workflow);
  writeJsonFile(workflowsIndex(), index);
}

export function updateWorkflow(workflow: WorkflowTemplate): void {
  writeJsonFile(workflowFile(workflow.id), workflow);
  const index = listWorkflows();
  const idx = index.findIndex(w => w.id === workflow.id);
  if (idx !== -1) index[idx] = workflow;
  writeJsonFile(workflowsIndex(), index);
}

export function deleteWorkflow(workflowId: string): void {
  deleteFile(workflowFile(workflowId));
  const index = listWorkflows();
  writeJsonFile(workflowsIndex(), index.filter(w => w.id !== workflowId));
}
