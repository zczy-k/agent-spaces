import { exec } from 'node:child_process';
import type { HookConfig, HookRule } from '@agent-spaces/shared';
import type { AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';
import { listHooks } from '../storage/hook-store.js';

type HookPhase = 'PreToolUse' | 'PostToolUse';

function logDebug(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.debug(`[HookEngine] ${message}`, details);
    return;
  }
  console.debug(`[HookEngine] ${message}`);
}

function matchToolName(matcher: string, toolName: string): boolean {
  if (matcher === '*') return true;
  if (matcher.startsWith('/') && matcher.endsWith('/')) {
    try {
      const regex = new RegExp(matcher.slice(1, -1));
      return regex.test(toolName);
    } catch (error: any) {
      console.warn(`[HookEngine] invalid matcher regex, falling back to exact match`, {
        matcher,
        toolName,
        error: error.message,
      });
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
    const cappedTimeout = Math.min(timeout, 30000);
    exec(command, { env: { ...process.env, ...env }, timeout: cappedTimeout }, (error) => {
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
    const cappedTimeout = Math.min(timeout, 30000);
    const timer = setTimeout(() => controller.abort(), cappedTimeout);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      console.warn(`[HookEngine] webhook non-2xx response`, {
        url,
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error: any) {
    console.warn(`[HookEngine] webhook error: ${error.message}`);
  }
}

async function executeRule(
  rule: HookRule,
  phase: HookPhase,
  toolName: string,
  workspaceId: string,
  context: { toolInput?: unknown; toolResult?: unknown },
  hookName?: string,
): Promise<void> {
  const timeout = rule.timeout ?? 10000;
  const startedAt = Date.now();

  logDebug('rule start', {
    workspaceId,
    phase,
    hookName,
    toolName,
    matcher: rule.matcher,
    type: rule.type,
    timeout,
  });

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
    console.warn(`[HookEngine] script type not implemented, skipping rule`, {
      workspaceId,
      phase,
      hookName,
      toolName,
      matcher: rule.matcher,
    });
  } else {
    console.warn(`[HookEngine] invalid rule configuration, skipping rule`, {
      workspaceId,
      phase,
      hookName,
      toolName,
      matcher: rule.matcher,
      type: rule.type,
      hasCommand: Boolean(rule.command),
      hasUrl: Boolean(rule.url),
    });
  }

  logDebug('rule finished', {
    workspaceId,
    phase,
    hookName,
    toolName,
    matcher: rule.matcher,
    type: rule.type,
    durationMs: Date.now() - startedAt,
  });
}

export class HookEngine {
  private hooks: HookConfig[] = [];
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  load(): void {
    this.hooks = listHooks(this.workspaceId);
    logDebug('loaded hooks', {
      workspaceId: this.workspaceId,
      totalHooks: this.hooks.length,
      enabledHooks: this.hooks.filter(h => h.enabled).length,
      hookNames: this.hooks.map(h => h.name),
    });
  }

  reload(): void {
    this.load();
  }

  getHooks(): HookConfig[] {
    return this.hooks;
  }

  async executeHooks(
    phase: HookPhase,
    toolName: string,
    context: { toolInput?: unknown; toolResult?: unknown },
  ): Promise<void> {
    const enabledHooks = this.hooks.filter(h => h.enabled);
    const promises: Promise<void>[] = [];
    let checkedRules = 0;
    let matchedRules = 0;

    logDebug('trigger received', {
      workspaceId: this.workspaceId,
      phase,
      toolName,
      totalHooks: this.hooks.length,
      enabledHooks: enabledHooks.length,
      hasToolInput: context.toolInput !== undefined,
      hasToolResult: context.toolResult !== undefined,
    });

    for (const hook of enabledHooks) {
      const rules = hook.hooks[phase];
      if (!rules) continue;
      for (const rule of rules) {
        checkedRules += 1;
        if (matchToolName(rule.matcher, toolName)) {
          matchedRules += 1;
          logDebug('rule matched', {
            workspaceId: this.workspaceId,
            phase,
            hookName: hook.name,
            toolName,
            matcher: rule.matcher,
            type: rule.type,
          });
          promises.push(executeRule(rule, phase, toolName, this.workspaceId, context, hook.name));
        }
      }
    }

    const results = await Promise.allSettled(promises);
    const rejectedRules = results.filter(result => result.status === 'rejected').length;
    logDebug('trigger finished', {
      workspaceId: this.workspaceId,
      phase,
      toolName,
      checkedRules,
      matchedRules,
      rejectedRules,
    });
  }
}

export function wrapOnEventWithHooks(
  onEvent: (event: AgentRuntimeEvent) => void,
  workspaceId: string,
  hooksEnabled: boolean | undefined,
): (event: AgentRuntimeEvent) => void {
  if (!hooksEnabled) {
    logDebug('hooks disabled for workspace', { workspaceId });
    return onEvent;
  }

  const engine = new HookEngine(workspaceId);
  engine.load();
  const toolNameById = new Map<string, string>();

  return (event: AgentRuntimeEvent) => {
    onEvent(event);
    if (event.type === 'tool_use') {
      toolNameById.set(event.id, event.name);
      logDebug('tool_use event mapped', {
        workspaceId,
        toolUseId: event.id,
        toolName: event.name,
      });
      engine.executeHooks('PreToolUse', event.name, { toolInput: event.input });
    }
    if (event.type === 'tool_result') {
      const toolName = event.toolUseId ? (toolNameById.get(event.toolUseId) ?? '') : '';
      if (toolName) {
        logDebug('tool_result event resolved', {
          workspaceId,
          toolUseId: event.toolUseId,
          toolName,
        });
        engine.executeHooks('PostToolUse', toolName, { toolResult: event.result });
      } else {
        logDebug('tool_result event skipped without matching tool_use', {
          workspaceId,
          toolUseId: event.toolUseId,
        });
      }
    }
  };
}
