import { exec } from 'node:child_process';
import type { HookConfig, HookRule } from '@agent-spaces/shared';
import type { AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';
import { listHooks } from '../storage/hook-store.js';

function matchToolName(matcher: string, toolName: string): boolean {
  if (matcher === '*') return true;
  if (matcher.startsWith('/') && matcher.endsWith('/')) {
    try {
      const regex = new RegExp(matcher.slice(1, -1));
      return regex.test(toolName);
    } catch {
      return matcher === toolName;
    }
  }
  return matcher === toolName;
}

function executeCommand(
  command: string,
  env: Record<string, string>,
  timeout: number,
): Promise<void> {
  return new Promise((resolve) => {
    exec(command, { env: { ...process.env, ...env }, timeout: Math.min(timeout, 30000) }, (error) => {
      if (error) console.warn(`[HookEngine] command error: ${error.message}`);
      resolve();
    });
  });
}

async function executeWebhook(
  url: string,
  body: Record<string, unknown>,
  timeout: number,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeout, 30000));
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (error: any) {
    console.warn(`[HookEngine] webhook error: ${error.message}`);
  }
}

async function executeRule(
  rule: HookRule,
  phase: 'PreToolUse' | 'PostToolUse',
  toolName: string,
  workspaceId: string,
  context: { toolInput?: unknown; toolResult?: unknown },
): Promise<void> {
  const timeout = rule.timeout ?? 10000;

  if (rule.type === 'command' && rule.command) {
    await executeCommand(rule.command, {
      HOOK_TOOL_NAME: toolName,
      HOOK_TOOL_INPUT: JSON.stringify(context.toolInput ?? {}),
      HOOK_TOOL_RESULT: JSON.stringify(context.toolResult ?? ''),
      HOOK_WORKSPACE_ID: workspaceId,
      HOOK_PHASE: phase,
    }, timeout);
  } else if (rule.type === 'webhook' && rule.url) {
    await executeWebhook(rule.url, {
      event: phase,
      toolName,
      toolInput: context.toolInput,
      toolResult: context.toolResult ?? undefined,
      timestamp: new Date().toISOString(),
      workspaceId,
    }, timeout);
  } else if (rule.type === 'script') {
    console.warn(`[HookEngine] script type not implemented, skipping rule in ${phase}`);
  }
}

export class HookEngine {
  private hooks: HookConfig[] = [];
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  load(): void {
    this.hooks = listHooks(this.workspaceId);
  }

  reload(): void {
    this.load();
  }

  getHooks(): HookConfig[] {
    return this.hooks;
  }

  async executeHooks(
    phase: 'PreToolUse' | 'PostToolUse',
    toolName: string,
    context: { toolInput?: unknown; toolResult?: unknown },
  ): Promise<void> {
    const enabledHooks = this.hooks.filter(h => h.enabled);
    const promises: Promise<void>[] = [];

    for (const hook of enabledHooks) {
      const rules = hook.hooks[phase];
      if (!rules) continue;
      for (const rule of rules) {
        if (matchToolName(rule.matcher, toolName)) {
          promises.push(executeRule(rule, phase, toolName, this.workspaceId, context));
        }
      }
    }

    await Promise.allSettled(promises);
  }
}

export function wrapOnEventWithHooks(
  onEvent: (event: AgentRuntimeEvent) => void,
  workspaceId: string,
  hooksEnabled: boolean | undefined,
): (event: AgentRuntimeEvent) => void {
  if (!hooksEnabled) return onEvent;

  const engine = new HookEngine(workspaceId);
  engine.load();

  return (event: AgentRuntimeEvent) => {
    onEvent(event);
    if (event.type === 'tool_use') {
      engine.executeHooks('PreToolUse', event.name, { toolInput: event.input });
    }
    if (event.type === 'tool_result') {
      engine.executeHooks('PostToolUse', event.name, { toolResult: event.result });
    }
  };
}
