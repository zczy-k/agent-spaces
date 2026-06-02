// packages/server/src/services/workflow-trigger-service.ts
// Cron + Webhook trigger management for workflows.

import crypto from 'node:crypto';
import type { default as nodeCronType, ScheduledTask } from 'node-cron';
import type { Workflow, WorkflowTrigger } from '@agent-spaces/shared';
import * as store from '../storage/workflow-store.js';

interface HookBinding {
  workflowId: string;
  triggerId: string;
}

export class WorkflowTriggerService {
  private cronJobs = new Map<string, ScheduledTask>();
  private hookIndex = new Map<string, Set<HookBinding>>();
  private nodeCron: typeof nodeCronType | null = null;

  constructor(private port: number = 3100) {
    try {
      this.nodeCron = require('node-cron');
    } catch {
      // node-cron not available
    }
  }

  async start(): Promise<void> {
    const workflows = store.listWorkflows();
    for (const wf of workflows) {
      this.registerTriggers(wf);
    }
    console.log(`[TriggerService] Started. ${this.cronJobs.size} cron jobs, ${this.hookIndex.size} hooks registered`);
  }

  reloadWorkflow(workflowId: string): void {
    this.clearTriggersForWorkflow(workflowId);
    const wf = store.getWorkflow(workflowId);
    if (wf) this.registerTriggers(wf);
  }

  removeWorkflow(workflowId: string): void {
    this.clearTriggersForWorkflow(workflowId);
  }

  getHookBindings(hookName: string): HookBinding[] {
    return Array.from(this.hookIndex.get(hookName) ?? []);
  }

  getHookConflicts(hookName: string, excludeWorkflowId?: string): { conflictWorkflowIds: string[] } {
    const bindings = this.hookIndex.get(hookName) ?? new Set();
    const ids = Array.from(bindings)
      .map(b => b.workflowId)
      .filter(id => id !== excludeWorkflowId);
    return { conflictWorkflowIds: [...new Set(ids)] };
  }

  getHookUrl(hookName: string): string {
    return `http://localhost:${this.port}/api/workflows/hook/${hookName}`;
  }

  validateCron(cronExpr: string): { valid: boolean; nextRuns: string[]; error?: string } {
    if (!this.nodeCron) return { valid: false, nextRuns: [], error: 'node-cron not available' };
    if (!this.nodeCron.validate(cronExpr)) {
      return { valid: false, nextRuns: [], error: 'Invalid cron expression' };
    }
    try {
      const CronExpressionParser = require('cron-parser');
      const interval = CronExpressionParser.parse(cronExpr);
      const nextRuns: string[] = [];
      for (let i = 0; i < 5; i++) {
        const iso = interval.next().toISOString();
        if (iso) nextRuns.push(iso);
      }
      return { valid: true, nextRuns };
    } catch (err: any) {
      return { valid: false, nextRuns: [], error: err.message };
    }
  }

  stop(): void {
    for (const [, task] of this.cronJobs) {
      task.stop();
    }
    this.cronJobs.clear();
    this.hookIndex.clear();
  }

  private registerTriggers(wf: Workflow): void {
    if (!wf.triggers) return;
    for (const trigger of wf.triggers) {
      if (!trigger.enabled) continue;
      if (trigger.type === 'cron') {
        this.registerCronJob(wf.id, trigger);
      } else if (trigger.type === 'hook') {
        this.registerHookBinding(wf.id, trigger);
      }
    }
  }

  private registerCronJob(workflowId: string, trigger: WorkflowTrigger & { type: 'cron' }): void {
    if (!this.nodeCron) return;
    const key = `${workflowId}:${trigger.id}`;
    try {
      const task = this.nodeCron.schedule(trigger.cron, () => {
        console.log(`[TriggerService] Cron fired for workflow ${workflowId}`);
        // TODO: trigger workflow execution via execution manager
      }, { timezone: trigger.timezone });
      this.cronJobs.set(key, task);
    } catch (err: any) {
      console.error(`[TriggerService] Invalid cron "${trigger.cron}" for workflow ${workflowId}: ${err.message}`);
    }
  }

  private registerHookBinding(workflowId: string, trigger: WorkflowTrigger & { type: 'hook' }): void {
    let bindings = this.hookIndex.get(trigger.hookName);
    if (!bindings) {
      bindings = new Set();
      this.hookIndex.set(trigger.hookName, bindings);
    }
    bindings.add({ workflowId, triggerId: trigger.id });
  }

  private clearTriggersForWorkflow(workflowId: string): void {
    for (const [key, task] of this.cronJobs) {
      if (key.startsWith(`${workflowId}:`)) {
        task.stop();
        this.cronJobs.delete(key);
      }
    }
    for (const [hookName, bindings] of this.hookIndex) {
      for (const binding of bindings) {
        if (binding.workflowId === workflowId) {
          bindings.delete(binding);
        }
      }
      if (bindings.size === 0) {
        this.hookIndex.delete(hookName);
      }
    }
  }
}
