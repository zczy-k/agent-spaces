import type { AgentConfig } from '@agent-spaces/shared';
import * as agentService from '../services/agent.js';
import {
  AGENT_TITLE_GENERATOR_PRESET_ID,
  getDefaultTitleGeneratorPreset,
} from '../services/agent.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import { getThinkingRuntimeConfig } from '../services/llm-model-config.js';

const FALLBACK_TITLE = 'Untitled';

export async function runTitleGeneratorAgent(input: {
  workspaceId: string;
  target: 'channel' | 'issue';
  requirement: string;
  description?: string;
}): Promise<string> {
  const requirement = input.requirement.trim();
  const description = input.description?.trim() ?? '';
  if (!requirement && !description) return FALLBACK_TITLE;

  const preset = findTitleGeneratorAgent(input.workspaceId);
  if (!preset.apiBase || !preset.apiKey || !preset.modelId) {
    console.info('[title-generator] skipped: model settings are not configured', {
      workspaceId: input.workspaceId,
      agentId: AGENT_TITLE_GENERATOR_PRESET_ID,
    });
    return FALLBACK_TITLE;
  }

  const session = agentService.create(input.workspaceId, preset.role, preset.id);
  agentService.updateStatus(input.workspaceId, session.id, 'active');

  const runtime = createAgentRuntime({
    kind: preset.runtimeKind,
    provider: preset.modelProvider,
    model: preset.modelId,
    apiKey: preset.apiKey,
    baseURL: getRuntimeBaseURL(preset.modelProvider, preset.apiBase),
    adapterBaseURL: preset.apiBase,
    ...getThinkingRuntimeConfig(preset),
  });

  const workingDir = agentService.resolveWorkingDir(input.workspaceId, preset);
  const userPrompt = [
    `Target: ${input.target}`,
    requirement ? `User requirement: ${requirement}` : undefined,
    description ? `Description: ${description}` : undefined,
    'Generate exactly one short title.',
  ].filter(Boolean).join('\n');

  const startedAt = Date.now();
  let completed = false;
  try {
    const result = await runtime.execute(userPrompt, workingDir, {
      maxTurns: 1,
      systemPrompt: preset.systemPrompt || getDefaultTitleGeneratorPreset().systemPrompt,
      userPrompt,
      outputStyle: preset.outputStyle,
    });

    agentService.complete(input.workspaceId, session.id, result.success ? undefined : result.error, {
      runtime: preset.runtimeKind,
      model: preset.modelId,
      summary: result.summary,
      output: result.output,
      durationMs: Date.now() - startedAt,
      usage: result.usage,
      costUsd: result.costUsd,
    });
    completed = true;

    if (!result.success) {
      throw new Error(result.error || 'Title generator failed');
    }

    const title = sanitizeTitle(result.output.join('\n'));
    return title || FALLBACK_TITLE;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!completed) {
      agentService.complete(input.workspaceId, session.id, message, {
        runtime: preset.runtimeKind,
        model: preset.modelId,
        summary: message,
        durationMs: Date.now() - startedAt,
      });
    }
    throw err;
  }
}

function findTitleGeneratorAgent(workspaceId: string): AgentConfig {
  return agentService.listPresets(workspaceId).find((agent) => agent.id === AGENT_TITLE_GENERATOR_PRESET_ID)
    ?? agentService.readAgentTemplate(AGENT_TITLE_GENERATOR_PRESET_ID)
    ?? getDefaultTitleGeneratorPreset();
}

function sanitizeTitle(output: string): string {
  const title = output
    .split('\n')
    .filter((line) => !isRuntimeNoise(line))
    .map((line) => stripCodeFence(line).trim())
    .find(Boolean);

  return title
    ?.replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '')
    .replace(/[\u3002.!！?？:：;；]+$/g, '')
    .trim()
    .slice(0, 80) ?? '';
}

function stripCodeFence(line: string): string {
  return line.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
}

function isRuntimeNoise(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed
    || /^\[Usage\]/.test(trimmed)
    || /^Claude Code initialized\b/i.test(trimmed)
    || /^Codex initialized\b/i.test(trimmed)
    || /^Tool:/i.test(trimmed);
}

function getRuntimeBaseURL(provider?: string, apiBase?: string): string | undefined {
  if (
    provider === 'openai-responses-to-anthropic-messages'
    || provider === 'openai-chat-completions-to-anthropic-messages'
  ) return undefined;
  return apiBase;
}
