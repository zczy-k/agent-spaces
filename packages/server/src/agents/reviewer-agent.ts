/**
 * Reviewer Agent — reviews diff of completed task, outputs approve/changes_requested/reject.
 */

import * as agentService from '../services/agent.js';
import * as taskService from '../services/task.js';
import * as issueService from '../services/issue.js';
import * as channelService from '../services/channel.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import type { AgentContext } from './agent-context.js';
import type { AgentConfig, TaskResult } from '@agent-spaces/shared';

export async function runReviewer(
  workspaceId: string,
  taskId: string,
  issueId: string,
  taskResult: TaskResult,
  ctx: AgentContext,
): Promise<void> {
  const issue = issueService.getById(workspaceId, issueId);
  if (!issue) {
    console.warn(`[reviewer] issue not found workspaceId=${workspaceId} issueId=${issueId} taskId=${taskId}`);
    return;
  }

  const reviewerPreset = findIssueMemberAgent(workspaceId, issue, 'reviewer');
  if (!reviewerPreset) {
    console.warn(`[reviewer] no reviewer member found workspaceId=${workspaceId} issueId=${issueId} channelId=${issue.channelId} taskId=${taskId}`);
    taskService.updateStatus(workspaceId, taskId, 'waiting_review', { result: taskResult });
    ctx.broadcast('task.status_changed', { taskId, from: 'running', to: 'waiting_review' });
    return;
  }

  const reviewer = agentService.getOrCreateSessionForConfig(workspaceId, reviewerPreset);
  ctx.broadcast('agent.started', reviewer);

  const reviewerFromStatus = reviewer.status;
  agentService.updateStatus(workspaceId, reviewer.id, 'active');
  issueService.addAgent(workspaceId, issueId, reviewerPreset.id);
  ctx.broadcast('agent.status_changed', { agentId: reviewer.id, from: reviewerFromStatus, to: 'active' });

  ctx.broadcast('agent.output', {
    agentId: reviewer.id,
    data: `Reviewing task: ${taskId}`,
  });

  // Use runtime to review.
  const runtime = createAgentRuntime({
    kind: reviewerPreset.runtimeKind,
    provider: reviewerPreset.modelProvider,
    model: reviewerPreset.modelId,
    apiKey: reviewerPreset.apiKey,
    baseURL: reviewerPreset.apiBase,
  });
  const reviewResult = await runtime.execute(
    `Review the following task result:\nSuccess: ${taskResult.success}\nSummary: ${taskResult.summary}`,
    agentService.resolveWorkingDir(workspaceId, reviewerPreset),
    {
      maxTurns: 100,
      mcpServers: agentService.getMcpServers(reviewerPreset.mcps),
      skills: agentService.getAvailableSkillNames(agentService.getAgentConfigDir(workspaceId, reviewerPreset), reviewerPreset.skills),
      configDir: agentService.getAgentConfigDir(workspaceId, reviewerPreset),
      sandboxDirs: reviewerPreset.sandboxDirs,
    },
  );

  for (const line of reviewResult.output) {
    ctx.broadcast('agent.output', { agentId: reviewer.id, data: line });
  }

  // Mock: always approve for now
  const approved = true;

  agentService.complete(workspaceId, reviewer.id);
  ctx.broadcast('agent.completed', {
    agentId: reviewer.id,
    result: { success: true, summary: approved ? 'Approved' : 'Changes requested', artifacts: [] },
  });

  if (approved) {
    // Mark task as done
    taskService.updateStatus(workspaceId, taskId, 'done', { result: taskResult });
    ctx.broadcast('task.status_changed', { taskId, from: 'running', to: 'done' });

    // Move issue to review_pending → approved
    issueService.updateStatus(workspaceId, issueId, 'review_pending');
    ctx.broadcast('issue.status_changed', { issueId, from: 'in_progress', to: 'review_pending' });

    issueService.updateStatus(workspaceId, issueId, 'approved');
    ctx.broadcast('issue.status_changed', { issueId, from: 'review_pending', to: 'approved' });

    // Notify channel
    ctx.broadcast('agent.output', {
      agentId: reviewer.id,
      data: `Issue ${issueId} approved. All tasks completed.`,
    });
  } else {
    // Request changes
    taskService.updateStatus(workspaceId, taskId, 'failed', {
      result: { ...taskResult, error: 'Changes requested by reviewer' },
    });
    ctx.broadcast('task.status_changed', { taskId, from: 'running', to: 'failed' });

    issueService.updateStatus(workspaceId, issueId, 'changes_requested');
    ctx.broadcast('issue.status_changed', { issueId, from: 'in_progress', to: 'changes_requested' });
  }
}

function findIssueMemberAgent(
  workspaceId: string,
  issue: NonNullable<ReturnType<typeof issueService.getById>>,
  role: AgentConfig['role'],
): AgentConfig | null {
  const channel = channelService.getChannel(workspaceId, issue.channelId);
  if (!channel) return null;

  return agentService.findEnabledPresetByRoleInMembers(workspaceId, channel.members, role);
}
