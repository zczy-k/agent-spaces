import { z } from 'zod';
import type {
  AgentFunctionTool,
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeEvent,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';

type OmpSdk = {
  createAgentSession: (options: Record<string, unknown>) => Promise<{
    session: OmpSession;
    modelFallbackMessage?: string;
  }>;
  discoverAuthStorage: (agentDir?: string) => Promise<unknown>;
  ModelRegistry: new (authStorage: unknown) => OmpModelRegistry;
  SessionManager: {
    create(cwd: string): unknown;
    open(sessionFile: string): Promise<unknown>;
  };
};

type OmpSession = {
  sessionManager: {
    getSessionFile(): string | undefined;
    getSessionId(): string;
  };
  subscribe(listener: (event: OmpSessionEvent) => void): () => void;
  prompt(prompt: string): Promise<unknown>;
  abort(): void;
  dispose(): Promise<void>;
};

type OmpModel = {
  id: string;
  provider: string;
};

type OmpModelRegistry = {
  refresh(): Promise<void>;
  getAvailable(): OmpModel[];
  find(provider: string, modelId: string): OmpModel | undefined;
  registerProvider(providerName: string, config: Record<string, unknown>, sourceId?: string): void;
};

type OmpSessionEvent =
  | {
      type: 'message_update';
      assistantMessageEvent:
        | { type: 'text_delta'; delta: string }
        | { type: 'thinking_delta'; delta: string }
        | { type: 'error'; error: unknown }
        | { type: string; [key: string]: unknown };
    }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_execution_update'; toolCallId: string; toolName: string; partialResult: unknown }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; result: unknown; isError: boolean }
  | { type: string; [key: string]: unknown };

type OmpMessageUpdateEvent = Extract<OmpSessionEvent, { type: 'message_update' }>;
type OmpToolExecutionStartEvent = Extract<OmpSessionEvent, { type: 'tool_execution_start' }>;
type OmpToolExecutionUpdateEvent = Extract<OmpSessionEvent, { type: 'tool_execution_update' }>;
type OmpToolExecutionEndEvent = Extract<OmpSessionEvent, { type: 'tool_execution_end' }>;

type OmpCustomTool = {
  name: string;
  label: string;
  description: string;
  parameters: z.ZodType;
  execute(
    toolCallId: string,
    params: unknown,
    onUpdate: unknown,
    ctx: unknown,
    signal?: AbortSignal,
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }>;
};

/**
 * Runtime backed by @oh-my-pi/pi-coding-agent.
 *
 * The current published SDK is Bun-native: its exports point at TypeScript
 * source that imports `bun` and uses `Bun.*`. Keep the import lazy so the
 * Node-based Agent Spaces server can start even when this runtime is not used.
 */
export class OhMyPiRuntime implements AgentRuntime {
  private session: OmpSession | null = null;

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
      const sdk = await loadOhMyPiSdk();
      const authStorage = await sdk.discoverAuthStorage(options?.configDir);
      const modelRegistry = new sdk.ModelRegistry(authStorage);
      await modelRegistry.refresh();

      if (this.config.apiKey && this.config.model && this.config.baseURL) {
        registerRuntimeProvider(modelRegistry, this.config);
      }

      const model = resolveModel(modelRegistry, this.config);
      const sessionManager = options?.resumeSessionId
        ? await sdk.SessionManager.open(options.resumeSessionId)
        : sdk.SessionManager.create(cwd);

      const created = await sdk.createAgentSession({
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

async function loadOhMyPiSdk(): Promise<OmpSdk> {
  if (!('Bun' in globalThis)) {
    throw new Error(
      'Oh My Pi runtime requires running Agent Spaces server under Bun. The current @oh-my-pi/pi-coding-agent package imports Bun-native APIs such as `bun`/`Bun.*`, so it cannot be embedded in the Node server process. Run the server with Bun or use the Oh My Pi CLI/RPC process boundary instead.',
    );
  }

  try {
    const specifier = '@oh-my-pi/pi-coding-agent';
    return await import(specifier) as OmpSdk;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load @oh-my-pi/pi-coding-agent: ${message}`);
  }
}

function resolveModel(modelRegistry: OmpModelRegistry, config: AgentRuntimeConfig): OmpModel | undefined {
  if (config.model) {
    const exact = config.provider ? modelRegistry.find(String(config.provider), config.model) : undefined;
    if (exact) return exact;
    const byId = modelRegistry.getAvailable().find((model) => model.id === config.model || `${model.provider}/${model.id}` === config.model);
    if (byId) return byId;
  }
  return modelRegistry.getAvailable()[0];
}

function registerRuntimeProvider(modelRegistry: OmpModelRegistry, config: AgentRuntimeConfig): void {
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

function normalizeOmpApi(provider?: AgentRuntimeConfig['provider']): string {
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

function normalizeThinkingLevel(config: AgentRuntimeConfig): string | undefined {
  if (config.thinkingEnabled === false) return 'off';
  return config.thinkingEffort ?? 'medium';
}

function buildCustomTools(
  functionTools: AgentFunctionTool[] | undefined,
  output: string[],
  options: AgentRunOptions | undefined,
  log: (message: string) => void,
): OmpCustomTool[] {
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
  }));
}

function mapSessionEvent(event: OmpSessionEvent, output: string[]): {
  textDelta?: string;
  error?: string;
  events: AgentRuntimeEvent[];
} {
  const events: AgentRuntimeEvent[] = [];

  if (isOmpMessageUpdateEvent(event)) {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent.type === 'text_delta' && typeof assistantEvent.delta === 'string') {
      output.push(assistantEvent.delta);
      events.push({ type: 'output', line: assistantEvent.delta });
      return { textDelta: assistantEvent.delta, events };
    }
    if (assistantEvent.type === 'thinking_delta' && typeof assistantEvent.delta === 'string') {
      events.push({ type: 'reasoning', text: assistantEvent.delta, status: 'streaming' });
      return { events };
    }
    if (assistantEvent.type === 'error') {
      return { error: stringifyToolResult(assistantEvent.error), events };
    }
    return { events };
  }

  if (isOmpToolExecutionStartEvent(event)) {
    const line = `Tool: ${event.toolName} input=${JSON.stringify(event.args)}`;
    output.push(line);
    events.push({ type: 'tool_use', id: event.toolCallId, name: event.toolName, input: event.args, line });
  } else if (isOmpToolExecutionUpdateEvent(event)) {
    events.push({ type: 'tool_result', toolUseId: event.toolCallId, result: event.partialResult });
  } else if (isOmpToolExecutionEndEvent(event)) {
    events.push({ type: 'tool_result', toolUseId: event.toolCallId, result: event.result });
    if (event.isError) return { error: stringifyToolResult(event.result), events };
  }

  return { events };
}

function isOmpMessageUpdateEvent(event: OmpSessionEvent): event is OmpMessageUpdateEvent {
  return event.type === 'message_update' && isRecord(event.assistantMessageEvent);
}

function isOmpToolExecutionStartEvent(event: OmpSessionEvent): event is OmpToolExecutionStartEvent {
  return event.type === 'tool_execution_start'
    && typeof event.toolCallId === 'string'
    && typeof event.toolName === 'string';
}

function isOmpToolExecutionUpdateEvent(event: OmpSessionEvent): event is OmpToolExecutionUpdateEvent {
  return event.type === 'tool_execution_update'
    && typeof event.toolCallId === 'string'
    && typeof event.toolName === 'string';
}

function isOmpToolExecutionEndEvent(event: OmpSessionEvent): event is OmpToolExecutionEndEvent {
  return event.type === 'tool_execution_end'
    && typeof event.toolCallId === 'string'
    && typeof event.toolName === 'string'
    && typeof event.isError === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
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
