/**
 * Agent hooks: chain executor completion to reviewer processing.
 */

import type { TaskResult } from '@agent-spaces/shared';
import type { AgentContext } from '../agents/agent-context.js';
import { runReviewer } from '../agents/reviewer-agent.js';

/**
 * Hook: executor complete triggers reviewer.
 * This is the core hook in the agent orchestration pipeline.
 */
export async function onExecutorComplete(
  workspaceId: string,
  taskId: string,
  issueId: string,
  result: TaskResult,
  ctx: AgentContext,
): Promise<void> {
  console.log(
    `[hook:onExecutorComplete] entered workspaceId=${workspaceId} taskId=${taskId} issueId=${issueId} success=${result.success} summary=${JSON.stringify(result.summary)}`,
  );

  if (!result.success) {
    console.warn(`[hook:onExecutorComplete] task ${taskId} failed: ${result.error}`);
    return;
  }

  console.log(`[hook:onExecutorComplete] triggering reviewer taskId=${taskId} issueId=${issueId}`);
  await runReviewer(workspaceId, taskId, issueId, result, ctx);
  console.log(`[hook:onExecutorComplete] reviewer completed taskId=${taskId} issueId=${issueId}`);
}
