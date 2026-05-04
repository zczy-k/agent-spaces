/**
 * Planner Agent — receives an issue, decomposes into tasks, assigns Executors.
 */

import * as agentService from '../services/agent.js';
import * as issueService from '../services/issue.js';
import * as issueCommentService from '../services/issue-comment.js';
import * as messageService from '../services/message.js';
import * as taskService from '../services/task.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import type { AgentContext } from './agent-context.js';
import { onExecutorComplete } from '../hooks/agent-hooks.js';
import * as wsService from '../services/workspace.js';
import { broadcastToWorkspace } from '../ws/connection-manager.js';

export async function runPlanner(
  workspaceId: string,
  issueId: string,
  ctx: AgentContext,
): Promise<void> {
  // Create planner session
  const planner = agentService.create(workspaceId, 'planner');
  ctx.broadcast('agent.started', planner);
  agentService.updateStatus(workspaceId, planner.id, 'active');
  ctx.broadcast('agent.status_changed', { agentId: planner.id, from: 'idle', to: 'active' });

  ctx.broadcast('agent.output', { agentId: planner.id, data: `Planning issue: ${issueId}` });

  // Move issue to planned
  const issue = issueService.updateStatus(workspaceId, issueId, 'planned');
  if (!issue) {
    agentService.complete(workspaceId, planner.id, 'Issue not found');
    return;
  }
  ctx.broadcast('issue.status_changed', { issueId, from: 'draft', to: 'planned' });

  // Use runtime to plan.
  const plannerPreset = agentService.listPresets(workspaceId)?.find(
    (agent) => agent.role === 'planner' && agent.enabled !== false,
  );
  const runtime = plannerPreset ? createAgentRuntime({
    kind: plannerPreset.runtimeKind,
    provider: plannerPreset.modelProvider,
    model: plannerPreset.modelId,
    apiKey: plannerPreset.apiKey,
    baseURL: plannerPreset.apiBase,
  }) : createAgentRuntime();
  const workspace = wsService.getById(workspaceId);
  const planResult = await runtime.execute(
    buildPlannerPrompt(issue),
    plannerPreset ? agentService.resolveWorkingDir(workspaceId, plannerPreset) : '',
    plannerPreset ? {
      maxTurns: 100,
      mcpServers: agentService.getMcpServers(plannerPreset.mcps),
      skills: agentService.getAvailableSkillNames(agentService.getAgentConfigDir(workspaceId, plannerPreset), plannerPreset.skills),
      configDir: agentService.getAgentConfigDir(workspaceId, plannerPreset),
      sandboxDirs: plannerPreset.sandboxDirs,
    } : undefined,
  );

  for (const line of planResult.output) {
    ctx.broadcast('agent.output', { agentId: planner.id, data: line });
  }
  persistIssueAgentMessage(workspaceId, issue, planner.id, 'planner', planResult.summary, planResult.output, {
    runtime: plannerPreset?.runtimeKind,
    model: plannerPreset?.modelId,
    workspaceRoot: workspace?.boundDirs?.[0],
  });

  // Decompose into a single task covering the issue.
  const tasks = [
    taskService.create(workspaceId, issueId, {
      title: `Implement: ${issue.title}`,
      description: issue.description,
    }),
  ];

  for (const task of tasks) {
    issueService.addTask(workspaceId, issueId, task.id);
    ctx.broadcast('task.created', task);
  }

  // Move issue to in_progress
  issueService.updateStatus(workspaceId, issueId, 'in_progress');
  ctx.broadcast('issue.status_changed', { issueId, from: 'planned', to: 'in_progress' });

  // Complete planner
  agentService.complete(workspaceId, planner.id);
  ctx.broadcast('agent.completed', { agentId: planner.id, result: { success: true, summary: `Planned ${tasks.length} tasks`, artifacts: [] } });

  // Start executors for each task (sequentially for now)
  for (const task of tasks) {
    await runExecutor(workspaceId, task.id, issueId, ctx);
  }
}

function buildPlannerPrompt(issue: NonNullable<ReturnType<typeof issueService.getById>>): string {
  return [
    '你是策划者 Agent。请基于下面的议题内容制定执行计划。',
    '',
    'Current issue context:',
    `- Issue id: ${issue.id}`,
    `- Title: ${issue.title}`,
    `- Status: ${issue.status}`,
    `- Description: ${issue.description || '(empty)'}`,
    '',
    '请直接基于上述议题内容输出计划。不要声称无法查看当前议题；议题内容已经在 prompt 中提供。',
  ].join('\n');
}

function persistIssueAgentMessage(
  workspaceId: string,
  issue: NonNullable<ReturnType<typeof issueService.getById>>,
  senderId: string,
  senderRole: string,
  summary: string,
  output: string[],
  metadata: { runtime?: string; model?: string; workspaceRoot?: string },
): void {
  const content = output.join('\n').trim() || summary;
  if (!content.trim()) return;

  const message = messageService.createMessage(workspaceId, issue.channelId, {
    senderId,
    senderRole,
    content,
    type: 'text',
    status: 'completed',
    metadata: {
      runtime: metadata.runtime,
      model: metadata.model,
      summary,
    },
  });
  broadcastToWorkspace(workspaceId, 'channel.message', message);

  const comment = issueCommentService.createIssueComment(workspaceId, issue.id, {
    senderId,
    senderRole,
    content: summary || content,
    source: 'agent_progress',
    metadata: {
      channelId: issue.channelId,
      messageId: message.id,
      runtime: metadata.runtime,
      model: metadata.model,
      summary,
    },
  });
  if (comment) broadcastToWorkspace(workspaceId, 'issue.updated', issueService.getById(workspaceId, issue.id));
}

async function runExecutor(
  workspaceId: string,
  taskId: string,
  issueId: string,
  ctx: AgentContext,
): Promise<void> {
  const executor = agentService.create(workspaceId, 'executor');
  ctx.broadcast('agent.started', executor);

  agentService.updateStatus(workspaceId, executor.id, 'active');
  ctx.broadcast('agent.status_changed', { agentId: executor.id, from: 'idle', to: 'active' });

  const task = taskService.assignAgent(workspaceId, taskId, executor.id);
  if (!task) {
    agentService.complete(workspaceId, executor.id, 'Task not found');
    return;
  }
  ctx.broadcast('task.status_changed', { taskId, from: 'pending', to: 'running' });

  agentService.assignTask(workspaceId, executor.id, taskId);

  console.log(
    `[executor] starting runtime workspaceId=${workspaceId} taskId=${taskId} issueId=${issueId} executorAgentId=${executor.id} runtime=open-agent-sdk(default) sandboxDirs=${JSON.stringify(task.sandboxDirs ?? [])}`,
  );
  const runtime = createAgentRuntime();
  ctx.broadcast('agent.output', { agentId: executor.id, data: `Executing task: ${task.title}` });
  ctx.broadcast('agent.output', {
    agentId: executor.id,
    data: '[debug] executor runtime=open-agent-sdk(default); hook:onExecutorComplete should run after this executor finishes',
  });

  const result = await runtime.execute(
    `${task.title}\n\n${task.description}`,
    '',
    { sandboxDirs: task.sandboxDirs },
  );
  console.log(
    `[executor] runtime completed workspaceId=${workspaceId} taskId=${taskId} issueId=${issueId} executorAgentId=${executor.id} success=${result.success} summary=${JSON.stringify(result.summary)}`,
  );

  for (const line of result.output) {
    ctx.broadcast('agent.output', { agentId: executor.id, data: line });
    ctx.broadcast('task.output', { taskId, data: line });
  }

  // Complete executor
  agentService.complete(workspaceId, executor.id);
  ctx.broadcast('agent.completed', { agentId: executor.id, result });

  // Hook: executor complete → triggers reviewer
  console.log(`[executor] invoking hook:onExecutorComplete taskId=${taskId} issueId=${issueId}`);
  await onExecutorComplete(workspaceId, taskId, issueId, result, ctx);
}
