import type { AgentConfig, Issue, Task, TaskResult, TaskStatus } from '@agent-spaces/shared';
import type { AgentContext } from './agent-context.js';
import type { AgentFunctionTool } from '../adapters/agent-runtime-types.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import * as agentService from '../services/agent.js';
import * as channelService from '../services/channel.js';
import * as issueService from '../services/issue.js';
import * as taskService from '../services/task.js';
import { onExecutorComplete } from '../hooks/agent-hooks.js';

const ACTIVE_TASK_STATUSES: TaskStatus[] = ['running', 'retrying', 'waiting_review'];

export interface PlannerTaskSyncInput {
  plannerPreset: AgentConfig;
  plannerSessionId: string;
  planSummary: string;
  planOutput: string[];
}

interface TaskDraft {
  key: string;
  title: string;
  description: string;
  agentConfigId?: string;
  dependsOnKeys?: string[];
  sandboxDirs?: string[];
}

export async function syncIssueTasksAfterPlanning(
  workspaceId: string,
  issueId: string,
  input: PlannerTaskSyncInput,
  ctx: AgentContext,
): Promise<void> {
  const issue = issueService.getById(workspaceId, issueId);
  if (!issue) {
    console.warn(`[issue-task-controller] issue not found workspaceId=${workspaceId} issueId=${issueId}`);
    return;
  }

  const taskSyncPreset = findIssueMemberAgent(workspaceId, issue, 'custom') ?? input.plannerPreset;
  const taskSyncAgent = agentService.getOrCreateSessionForConfig(workspaceId, taskSyncPreset);
  ctx.broadcast('agent.started', taskSyncAgent);

  const fromStatus = taskSyncAgent.status;
  agentService.updateStatus(workspaceId, taskSyncAgent.id, 'active');
  issueService.addAgent(workspaceId, issueId, taskSyncPreset.id);
  ctx.broadcast('agent.status_changed', { agentId: taskSyncAgent.id, from: fromStatus, to: 'active' });
  ctx.broadcast('agent.output', { agentId: taskSyncAgent.id, data: `Syncing issue tasks: ${issueId}` });

  const runtime = createRuntimeForPreset(taskSyncPreset);
  const result = await runtime.execute(
    buildTaskSyncPrompt(issue, input),
    agentService.resolveWorkingDir(workspaceId, taskSyncPreset),
    {
      maxTurns: 20,
      mcpServers: undefined,
      functionTools: createTaskSyncTools(workspaceId, issueId, ctx),
      skills: [],
      configDir: agentService.getAgentConfigDir(workspaceId, taskSyncPreset),
      sandboxDirs: taskSyncPreset.sandboxDirs,
    },
  );

  for (const line of result.output) {
    ctx.broadcast('agent.output', { agentId: taskSyncAgent.id, data: line });
  }

  agentService.complete(workspaceId, taskSyncAgent.id, result.success ? undefined : result.error || result.summary);
  ctx.broadcast('agent.completed', { agentId: taskSyncAgent.id, result });

  if (!result.success) {
    updateIssueStatus(workspaceId, issueId, 'error', ctx);
    return;
  }

  if (taskService.list(workspaceId, issueId).length === 0) {
    const fallbackTasks = replaceIssueTasksFromDrafts(workspaceId, issueId, ctx, [
      {
        key: 'implementation',
        title: `Implement: ${issue.title}`,
        description: issue.description || input.planSummary || input.planOutput.join('\n'),
      },
    ]);
    console.warn(`[issue-task-controller] task sync produced no tasks; created fallback count=${fallbackTasks.length}`);
  }

  updateIssueStatus(workspaceId, issueId, 'in_progress', ctx);
  await scheduleRunnableIssueTasks(workspaceId, issueId, ctx);
}

export async function scheduleRunnableIssueTasks(
  workspaceId: string,
  issueId: string,
  ctx: AgentContext,
): Promise<void> {
  const tasks = taskService.list(workspaceId, issueId);
  const doneIds = new Set(tasks.filter((task) => task.status === 'done').map((task) => task.id));
  const hasActive = tasks.some((task) => ACTIVE_TASK_STATUSES.includes(task.status));
  const runnable = tasks.filter((task) =>
    task.status === 'pending'
    && (task.dependsOnTaskIds ?? []).every((dependencyId) => doneIds.has(dependencyId)));

  if (runnable.length === 0) {
    if (!hasActive && tasks.length > 0 && tasks.every((task) => task.status === 'done')) {
      updateIssueStatus(workspaceId, issueId, 'completed', ctx);
    }
    return;
  }

  await Promise.all(runnable.map((task) => runIssueTask(workspaceId, issueId, task.id, ctx)));
}

export async function runIssueTask(
  workspaceId: string,
  issueId: string,
  taskId: string,
  ctx: AgentContext,
): Promise<void> {
  const issue = issueService.getById(workspaceId, issueId);
  const task = taskService.getById(workspaceId, taskId);
  if (!issue || !task) {
    console.warn(`[issue-task-controller] missing issue/task workspaceId=${workspaceId} issueId=${issueId} taskId=${taskId}`);
    return;
  }

  const executorPreset = findExecutorForTask(workspaceId, issue, task);
  if (!executorPreset) {
    const failed = taskService.updateStatus(workspaceId, taskId, 'failed', {
      result: {
        success: false,
        summary: 'No executor agent configured in issue channel members',
        artifacts: [],
        error: 'No executor member found for issue channel',
      },
    });
    broadcastTaskUpdate(ctx, failed, task.status);
    return;
  }

  const executor = agentService.getOrCreateSessionForConfig(workspaceId, executorPreset);
  ctx.broadcast('agent.started', executor);

  const executorFromStatus = executor.status;
  agentService.updateStatus(workspaceId, executor.id, 'active');
  issueService.addAgent(workspaceId, issueId, executorPreset.id);
  ctx.broadcast('agent.status_changed', { agentId: executor.id, from: executorFromStatus, to: 'active' });

  const runningTask = taskService.assignAgent(workspaceId, taskId, executor.id);
  if (!runningTask) {
    agentService.complete(workspaceId, executor.id, 'Task not found');
    return;
  }
  broadcastTaskUpdate(ctx, runningTask, task.status);
  agentService.assignTask(workspaceId, executor.id, taskId);

  const runtime = createRuntimeForPreset(executorPreset);
  ctx.broadcast('agent.output', { agentId: executor.id, data: `Executing task: ${runningTask.title}` });
  ctx.broadcast('agent.output', {
    agentId: executor.id,
    data: `[debug] executor agentConfigId=${executorPreset.id} taskAgentConfigId=${runningTask.agentConfigId || '(fallback)'} runtime=${executorPreset.runtimeKind ?? 'open-agent-sdk'}`,
  });

  const result = await runtime.execute(
    `${runningTask.title}\n\n${runningTask.description}`,
    agentService.resolveWorkingDir(workspaceId, executorPreset),
    {
      maxTurns: 100,
      mcpServers: agentService.getMcpServers(executorPreset.mcps),
      skills: agentService.getAvailableSkillNames(agentService.getAgentConfigDir(workspaceId, executorPreset), executorPreset.skills),
      configDir: agentService.getAgentConfigDir(workspaceId, executorPreset),
      sandboxDirs: runningTask.sandboxDirs ?? executorPreset.sandboxDirs,
    },
  );

  for (const line of result.output) {
    ctx.broadcast('agent.output', { agentId: executor.id, data: line });
    ctx.broadcast('task.output', { taskId, data: line });
  }

  if (!result.success) {
    const failedTask = taskService.updateStatus(workspaceId, taskId, 'failed', { result });
    broadcastTaskUpdate(ctx, failedTask, 'running');
  }

  agentService.complete(workspaceId, executor.id, result.success ? undefined : result.error || result.summary);
  ctx.broadcast('agent.completed', { agentId: executor.id, result });

  await onExecutorComplete(workspaceId, taskId, issueId, result, ctx);
  await scheduleRunnableIssueTasks(workspaceId, issueId, ctx);
}

export async function continueIssueTaskScheduling(
  workspaceId: string,
  issueId: string,
  ctx: AgentContext,
): Promise<void> {
  await scheduleRunnableIssueTasks(workspaceId, issueId, ctx);
}

function createTaskSyncTools(
  workspaceId: string,
  issueId: string,
  ctx: AgentContext,
): AgentFunctionTool[] {
  return [
    {
      name: 'ViewIssueTaskPlanningContext',
      description: 'Read the current issue, existing tasks, channel members, and valid assignable agent config ids.',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
        },
        required: ['issueId'],
        additionalProperties: false,
      },
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => {
        assertIssueId(issueId, input);
        const issue = requireIssue(workspaceId, issueId);
        const assignableAgents = getIssueAssignableAgentViews(workspaceId, issue);
        return {
          issue,
          existingTasks: taskService.list(workspaceId, issueId),
          channelMembers: assignableAgents,
          validAgentConfigIds: assignableAgents.map((agent) => agent.id),
        };
      },
    },
    {
      name: 'ReplaceIssueTasks',
      description: 'Replace current non-running issue tasks. Use stable task keys and dependsOnKeys; the controller maps keys to stored task ids.',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                agentConfigId: { type: 'string' },
                dependsOnKeys: { type: 'array', items: { type: 'string' } },
                sandboxDirs: { type: 'array', items: { type: 'string' } },
              },
              required: ['key', 'title', 'description'],
              additionalProperties: false,
            },
          },
        },
        required: ['issueId', 'tasks'],
        additionalProperties: false,
      },
      annotations: { destructive: true, openWorld: false },
      execute: async (input) => {
        assertIssueId(issueId, input);
        const data = input as { tasks?: unknown };
        const tasks = parseTaskDrafts(data.tasks);
        return replaceIssueTasksFromDrafts(workspaceId, issueId, ctx, tasks);
      },
    },
  ];
}

function replaceIssueTasksFromDrafts(
  workspaceId: string,
  issueId: string,
  ctx: AgentContext,
  drafts: TaskDraft[],
): Task[] {
  const issue = requireIssue(workspaceId, issueId);
  const validAgentIds = new Set(getIssueMemberPresets(workspaceId, issue).map((agent) => agent.id));
  const normalizedDrafts = drafts.map((task) => ({
    ...task,
    agentConfigId: task.agentConfigId && validAgentIds.has(task.agentConfigId) ? task.agentConfigId : undefined,
  }));

  const created = taskService.replaceIssueTasks(workspaceId, issueId, normalizedDrafts.map((task) => ({
    title: task.title,
    description: task.description,
    agentConfigId: task.agentConfigId,
    sandboxDirs: task.sandboxDirs,
  })));
  const idByKey = new Map(normalizedDrafts.map((task, index) => [task.key, created[index]?.id]));

  const updated = created.map((task, index) => {
    const dependencyIds = (normalizedDrafts[index]?.dependsOnKeys ?? [])
      .map((key) => idByKey.get(key))
      .filter((id): id is string => Boolean(id));
    return taskService.update(workspaceId, task.id, { dependsOnTaskIds: dependencyIds }) ?? task;
  });

  const runningTaskIds = taskService.list(workspaceId, issueId)
    .filter((task) => task.status === 'running')
    .map((task) => task.id);
  const issueTasks = issueService.replaceTasks(workspaceId, issueId, [
    ...runningTaskIds,
    ...updated.map((task) => task.id),
  ]);
  for (const task of updated) ctx.broadcast('task.created', task);
  if (issueTasks) ctx.broadcast('issue.updated', issueTasks);
  return updated;
}

function findExecutorForTask(
  workspaceId: string,
  issue: Issue,
  task: Task,
): AgentConfig | null {
  const assignable = getIssueMemberPresets(workspaceId, issue);
  if (task.agentConfigId) {
    const assigned = assignable.find((agent) => agent.id === task.agentConfigId && agent.role === 'executor');
    if (assigned) return assigned;
  }
  return assignable.find((agent) => agent.role === 'executor') ?? null;
}

function findIssueMemberAgent(
  workspaceId: string,
  issue: Issue,
  role: AgentConfig['role'],
): AgentConfig | null {
  const channel = channelService.getChannel(workspaceId, issue.channelId);
  if (!channel) return null;
  return agentService.findEnabledPresetByRoleInMembers(workspaceId, channel.members, role);
}

function getIssueMemberPresets(workspaceId: string, issue: Issue): AgentConfig[] {
  const channel = channelService.getChannel(workspaceId, issue.channelId);
  if (!channel) return [];
  const members = new Set(channel.members);
  return (agentService.listPresets(workspaceId) ?? [])
    .filter((agent) => members.has(agent.id) && agent.enabled !== false);
}

function getIssueAssignableAgentViews(workspaceId: string, issue: Issue): Array<Pick<AgentConfig, 'id' | 'name' | 'role' | 'description' | 'sandboxDirs'>> {
  return getIssueMemberPresets(workspaceId, issue).map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    description: agent.description,
    sandboxDirs: agent.sandboxDirs,
  }));
}

function updateIssueStatus(
  workspaceId: string,
  issueId: string,
  status: Issue['status'],
  ctx: AgentContext,
): Issue | null {
  const issue = issueService.getById(workspaceId, issueId);
  if (!issue) return null;
  if (issue.status === status) {
    ctx.broadcast('issue.updated', issue);
    return issue;
  }

  const updated = issueService.updateStatus(workspaceId, issueId, status);
  if (!updated) return null;
  ctx.broadcast('issue.status_changed', { issueId, from: issue.status, to: status });
  ctx.broadcast('issue.updated', updated);
  return updated;
}

function broadcastTaskUpdate(ctx: AgentContext, task: Task | null, from: TaskStatus): void {
  if (!task) return;
  ctx.broadcast('task.status_changed', { taskId: task.id, from, to: task.status });
  ctx.broadcast('task.updated', task);
}

function createRuntimeForPreset(preset: AgentConfig) {
  return createAgentRuntime({
    kind: preset.runtimeKind,
    provider: preset.modelProvider,
    model: preset.modelId,
    apiKey: preset.apiKey,
    baseURL: preset.apiBase,
  });
}

function buildTaskSyncPrompt(issue: Issue, input: PlannerTaskSyncInput): string {
  return [
    'You are the issue task synchronization controller.',
    'Use only the provided function tools to inspect context and replace issue tasks.',
    'Create focused implementation tasks with stable keys. Assign only valid agentConfigId values from the planning context. Express task dependencies with dependsOnKeys.',
    '',
    'Current issue:',
    `- Issue id: ${issue.id}`,
    `- Channel id: ${issue.channelId}`,
    `- Title: ${issue.title}`,
    `- Status: ${issue.status}`,
    `- Description: ${issue.description || '(empty)'}`,
    '',
    'Planner result:',
    `Summary: ${input.planSummary || '(empty)'}`,
    input.planOutput.join('\n').trim(),
  ].filter(Boolean).join('\n');
}

function parseTaskDrafts(value: unknown): TaskDraft[] {
  if (!Array.isArray(value)) throw new Error('tasks must be an array.');
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`tasks[${index}] must be an object.`);
    }
    const data = item as Record<string, unknown>;
    const key = asNonEmptyString(data.key, `tasks[${index}].key`);
    if (seen.has(key)) throw new Error(`duplicate task key: ${key}`);
    seen.add(key);
    return {
      key,
      title: asNonEmptyString(data.title, `tasks[${index}].title`),
      description: typeof data.description === 'string' ? data.description.trim() : '',
      agentConfigId: typeof data.agentConfigId === 'string' ? data.agentConfigId.trim() || undefined : undefined,
      dependsOnKeys: asStringArray(data.dependsOnKeys),
      sandboxDirs: asStringArray(data.sandboxDirs),
    };
  });
}

function assertIssueId(issueId: string, input: unknown): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Tool input must be an object.');
  if ((input as { issueId?: unknown }).issueId !== issueId) throw new Error(`issueId must match current issue id: ${issueId}`);
}

function requireIssue(workspaceId: string, issueId: string): Issue {
  const issue = issueService.getById(workspaceId, issueId);
  if (!issue) throw new Error(`Issue not found: ${issueId}`);
  return issue;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return normalized.length ? [...new Set(normalized)] : undefined;
}
