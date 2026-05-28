import type { AgentConfig } from '@agent-spaces/shared';
import * as agentService from '../services/agent.js';
import {
  AGENT_TITLE_GENERATOR_PRESET_ID,
  getDefaultTitleGeneratorPreset,
} from '../services/agent.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import { getThinkingRuntimeConfig } from '../services/llm-model-config.js';

const FALLBACK_TITLE = 'Untitled';
const TITLE_GENERATOR_CONSTRAINTS = [
  'Hard constraints:',
  '- Generate an objective scene title only.',
  '- Do not answer the user message.',
  '- Do not include a subject such as I, you, user, assistant, 我, 你, 用户, 助手.',
  '- Do not include greetings, questions, offers to help, or conversational replies.',
  '- The title must be a noun phrase that names the scenario, task, intent, problem, discussion, or analysis.',
  '- For "你好", return "打招呼场景".',
  '- Return exactly one title and nothing else.',
].join('\n');

export async function runTitleGeneratorAgent(input: {
  workspaceId: string;
  target: 'channel' | 'issue';
  requirement: string;
  description?: string;
}): Promise<string> {
  const requirement = input.requirement.trim();
  const description = input.description?.trim() ?? '';

  const preset = findTitleGeneratorAgent(input.workspaceId);
  if (!preset.apiBase || !preset.apiKey || !preset.modelId) {
    console.info('[title-generator] skipped: model settings are not configured', {
      workspaceId: input.workspaceId,
      agentId: AGENT_TITLE_GENERATOR_PRESET_ID,
    });
    return FALLBACK_TITLE;
  }

  console.info('[title-generator] starting', {
    workspaceId: input.workspaceId,
    target: input.target,
    agentId: AGENT_TITLE_GENERATOR_PRESET_ID,
    modelProvider: preset.modelProvider,
    modelId: preset.modelId,
    apiBase: maskUrl(preset.apiBase),
    requirementLength: requirement.length,
    descriptionLength: description.length,
  });

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
    !requirement && !description ? 'No user-provided title context is available. Generate a generic short title for this target.' : undefined,
    'Generate exactly one short title.',
  ].filter(Boolean).join('\n');

  const startedAt = Date.now();
  let completed = false;
  try {
    const result = await runtime.execute(userPrompt, workingDir, {
      maxTurns: 1,
      systemPrompt: [
        preset.systemPrompt || getDefaultTitleGeneratorPreset().systemPrompt,
        TITLE_GENERATOR_CONSTRAINTS,
      ].join('\n\n'),
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
    .replace(/[\u3002\u002e\u0021\uff01\u003f\uff1f\u003a\uff1a\u003b\uff1b]+$/g, '')
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

function maskUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.slice(0, 80);
  }
}
