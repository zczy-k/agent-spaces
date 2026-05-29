import { z } from 'zod';
import {
  createAgentSession,
  discoverAuthStorage,
  ModelRegistry,
  SessionManager,
  type AgentSessionEvent,
  type CustomTool,
} from '@oh-my-pi/pi-coding-agent';
import type {
  AgentFunctionTool,
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';

/**
 * Runtime backed by @oh-my-pi/pi-coding-agent.
 * Embeds the OMP agent in-process and streams AgentSession events directly.
 */
export class OhMyPiRuntime implements AgentRuntime {
  private session: Awaited<ReturnType<typeof createAgentSession>>['session'] | null = null;

  constructor(private readonly config: AgentRuntimeConfig = {}) {}

  async execute(prompt: string, workingDir: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    const output: string[] = [];
    const cwd = workingDir || process.cwd();
    const startTime = Date.now();
    const d = (message: string) => console.log(`[oh-my-pi] ${message}`);

    d(`starting | cwd=${cwd} provider=${this.config.provider ?? 'discovered'} model=${this.config.model ?? 'discovered'} baseURL=${this.config.baseURL ?? 'discovered'} maxTurns=${options?.maxTurns ?? '∞'} allowedTools=${options?.tools?.join(',') ?? 'all'} mcpServers=${Object.keys(options?.mcpServers ?? {}).join(',') || '-'} functionTools=${options?.functionTools?.map((tool) => tool.name).join(',') || '-'} skills=${options?.skills?.join(',') || '-'} sandboxDirs=${options?.sandboxDirs?.join(',') ?? '-'}`);
    d(`prompt: ${prompt.slice(0, 300)}${prompt.length > 300 ? '...' : ''}`);

    let unsubscribe: (() => void) | undefined;
    let resultText = '';
    let error: string | undefined;

    try {
      const authStorage = await discoverAuthStorage(options?.configDir);
      const modelRegistry = new ModelRegistry(authStorage);
      await modelRegistry.refresh();
      const model = resolveModel(modelRegistry, this.config);

      if (this.config.apiKey && this.config.model && this.config.baseURL) {
        registerRuntimeProvider(modelRegistry, this.config);
      }

      const sessionManager = options?.resumeSessionId
        ? await SessionManager.open(options.resumeSessionId)
        : SessionManager.create(cwd);

      const created = await createAgentSession({
        cwd,
        agentDir: options?.configDir,
        authStorage,
        modelRegistry,
        model,
        modelPattern: model ? undefined : this.config.model,
        thinkingLevel: normalizeThinkingLevel(this.config),
        sessionManager,
        systemPrompt: options?.systemPrompt ? [options.systemPrompt] : undefined,
        toolNames: options?.tools,
        customTools: buildCustomTools(options?.functionTools, output, options, d),
        enableMCP: true,
        enableLsp: true,
        autoApprove: this.config.permissionMode === 'bypassPermissions',
      });

      this.session = created.session;
      if (created.modelFallbackMessage) {
        output.push(created.modelFallbackMessage);
        options?.onEvent?.({ type: 'output', line: created.modelFallbackMessage });
      }

      const sessionId = created.session.sessionManager.getSessionFile() ?? created.session.sessionManager.getSessionId();
      if (sessionId) options?.onEvent?.({ type: 'session', sessionId });

      unsubscribe = created.session.subscribe((event) => {
        const mapped = mapSessionEvent(event, output);
        if (mapped.textDelta) resultText += mapped.textDelta;
        if (mapped.error) error = mapped.error;
        for (const runtimeEvent of mapped.events) {
          options?.onEvent?.(runtimeEvent);
        }
      });

      await created.session.prompt(appendOutputStyleToPrompt(prompt, options?.outputStyle));
      const elapsed = Date.now() - startTime;
      const finalText = resultText || lastOutputText(output);

      if (error) {
        d(`failed ${elapsed}ms | ${error}`);
        return {
          success: false,
          summary: 'Oh My Pi execution failed',
          artifacts: [],
          error,
          output,
          sessionId,
        };
      }

      if (finalText && output.at(-1) !== finalText) output.push(finalText);
      d(`done ${elapsed}ms`);
      return {
        success: true,
        summary: summarizeResult(finalText),
        artifacts: [],
        output,
        sessionId,
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      d(`failed ${elapsed}ms | ${message}`);
      if (err instanceof Error && err.stack) console.error(err.stack);

      return { success: false, summary: 'Oh My Pi execution failed', artifacts: [], error: message, output, sessionId: options?.resumeSessionId };
    } finally {
      unsubscribe?.();
      try {
        await this.session?.dispose();
      } finally {
        this.session = null;
      }
    }
  }

  stop(): void {
    this.session?.abort();
  }
}

type OmpModel = ReturnType<ModelRegistry['getAvailable']>[number];
type OmpApi = Parameters<ModelRegistry['registerProvider']>[1]['api'];
type OmpThinkingLevel = NonNullable<NonNullable<Parameters<typeof createAgentSession>[0]>['thinkingLevel']>;

function resolveModel(modelRegistry: ModelRegistry, config: AgentRuntimeConfig): OmpModel | undefined {
  if (config.model) {
    const exact = config.provider ? modelRegistry.find(String(config.provider), config.model) : undefined;
    if (exact) return exact;
    const byId = modelRegistry.getAvailable().find((model) => model.id === config.model || `${model.provider}/${model.id}` === config.model);
    if (byId) return byId;
  }
  return modelRegistry.getAvailable()[0];
}

function registerRuntimeProvider(modelRegistry: ModelRegistry, config: AgentRuntimeConfig): void {
  const providerName = sanitizeProviderName(config.provider);
  modelRegistry.registerProvider(providerName, {
    api: normalizeOmpApi(config.provider),
    baseUrl: config.baseURL,
    apiKey: config.apiKey,
    models: [{
      id: config.model!,
      name: config.model!,
      reasoning: config.thinkingEnabled !== false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 16_384,
    }],
  }, 'agent-spaces');
}

function normalizeOmpApi(provider?: AgentRuntimeConfig['provider']): OmpApi {
  switch (provider) {
    case 'anthropic-messages':
      return 'anthropic-messages';
    case 'openai-responses':
      return 'openai-responses';
    case 'gemini-generate-content':
      return 'google-generative-ai';
    case 'openai-chat-completions':
    default:
      return 'openai-completions';
  }
}

function sanitizeProviderName(provider?: AgentRuntimeConfig['provider']): string {
  const raw = String(provider || 'agent-spaces').trim().toLowerCase();
  return raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'agent-spaces';
}

function normalizeThinkingLevel(config: AgentRuntimeConfig): OmpThinkingLevel | undefined {
  if (config.thinkingEnabled === false) return 'off' as OmpThinkingLevel;
  switch (config.thinkingEffort ?? 'medium') {
    case 'low':
      return 'low' as OmpThinkingLevel;
    case 'high':
      return 'high' as OmpThinkingLevel;
    case 'medium':
    default:
      return 'medium' as OmpThinkingLevel;
  }
}

function buildCustomTools(
  functionTools: AgentFunctionTool[] | undefined,
  output: string[],
  options: AgentRunOptions | undefined,
  log: (message: string) => void,
): CustomTool[] {
  if (!functionTools?.length) return [];
  return functionTools.map((runtimeTool) => ({
    name: runtimeTool.name,
    label: runtimeTool.name,
    description: runtimeTool.description,
    parameters: z.object({}).passthrough(),
    async execute(toolCallId: string, params: unknown, _onUpdate: unknown, _ctx: unknown, signal?: AbortSignal) {
      void signal;
      const line = `Tool: ${runtimeTool.name} input=${JSON.stringify(params)}`;
      log(`tool use | id=${toolCallId} name=${runtimeTool.name} input=${JSON.stringify(params)}`);
      output.push(line);
      options?.onEvent?.({ type: 'tool_use', id: toolCallId, name: runtimeTool.name, input: params, line });
      const result = await runtimeTool.execute(params);
      options?.onEvent?.({ type: 'tool_result', toolUseId: toolCallId, result });
      return { content: [{ type: 'text', text: stringifyToolResult(result) }] };
    },
  } satisfies CustomTool));
}

function mapSessionEvent(event: AgentSessionEvent, output: string[]): {
  textDelta?: string;
  error?: string;
  events: NonNullable<AgentRunOptions['onEvent']> extends (event: infer T) => void ? T[] : never[];
} {
  const events: ReturnType<typeof mapSessionEvent>['events'] = [];

  if (event.type === 'message_update') {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent.type === 'text_delta') {
      output.push(assistantEvent.delta);
      events.push({ type: 'output', line: assistantEvent.delta });
      return { textDelta: assistantEvent.delta, events };
    }
    if (assistantEvent.type === 'thinking_delta') {
      events.push({ type: 'reasoning', text: assistantEvent.delta, status: 'streaming' });
      return { events };
    }
    if (assistantEvent.type === 'error') {
      return { error: stringifyToolResult(assistantEvent.error), events };
    }
    return { events };
  }

  if (event.type === 'tool_execution_start') {
    const line = `Tool: ${event.toolName} input=${JSON.stringify(event.args)}`;
    output.push(line);
    events.push({ type: 'tool_use', id: event.toolCallId, name: event.toolName, input: event.args, line });
  } else if (event.type === 'tool_execution_update') {
    events.push({ type: 'tool_result', toolUseId: event.toolCallId, result: event.partialResult });
  } else if (event.type === 'tool_execution_end') {
    events.push({ type: 'tool_result', toolUseId: event.toolCallId, result: event.result });
    if (event.isError) return { error: stringifyToolResult(event.result), events };
  }

  return { events };
}

function stringifyToolResult(result: unknown): string {
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function lastOutputText(output: string[]): string {
  return [...output].reverse().find((line) => line.trim() && !line.startsWith('Tool:')) ?? '';
}
