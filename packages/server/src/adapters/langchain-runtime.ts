import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { Connection } from '@langchain/mcp-adapters';
import { createAgent, initChatModel, tool } from 'langchain';
import type { CreateAgentParams } from 'langchain';
import { z } from 'zod';
import type {
  AgentFunctionTool,
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';

/**
 * Runtime backed by LangChain.js.
 * Uses LangChain's provider-neutral createAgent API and adapts Agent Spaces tools.
 */
export class LangChainRuntime implements AgentRuntime {
  private abortController: AbortController | null = null;

  constructor(private readonly config: AgentRuntimeConfig = {}) {}

  async execute(prompt: string, workingDir: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    this.abortController = new AbortController();
    const output: string[] = [];
    const cwd = workingDir || process.cwd();
    const startTime = Date.now();
    const d = (msg: string) => console.log(`[langchain] ${msg}`);
    const modelSettings = resolveLangChainModelSettings(this.config);
    const model = modelSettings.modelIdentifier;
    let mcpClient: MultiServerMCPClient | undefined;

    d(`starting | cwd=${cwd} provider=${this.config.provider ?? 'auto'} langchainProvider=${modelSettings.provider ?? 'auto'} model=${model} baseURL=${this.config.baseURL ?? 'default'} maxTurns=${options?.maxTurns ?? '∞'} tools=${options?.functionTools?.map((runtimeTool) => runtimeTool.name).join(',') || '-'} mcpServers=${Object.keys(options?.mcpServers ?? {}).join(',') || '-'} sandboxDirs=${options?.sandboxDirs?.join(',') ?? '-'}`);
    if (modelSettings.providerCorrectionReason) d(`provider adjusted | ${modelSettings.providerCorrectionReason}`);
    d(`prompt: ${prompt.slice(0, 300)}${prompt.length > 300 ? '...' : ''}`);

    try {
      const chatModel = await withTemporaryEnv(
        buildProviderEnv(this.config, modelSettings.provider),
        () => initChatModel(model, buildModelConfig(this.config)),
      );
      mcpClient = createLangChainMcpClient(options?.mcpServers, output, options, d);
      const mcpTools = mcpClient ? await mcpClient.getTools() : [];
      if (mcpClient) d(`resolved MCP tools | servers=${Object.keys(options?.mcpServers ?? {}).join(',') || '-'} tools=${mcpTools.map((mcpTool) => mcpTool.name).join(',') || '-'}`);
      const agent = createAgent({
        model: chatModel,
        tools: [
          ...buildLangChainTools(options?.functionTools, output, options, d),
          ...mcpTools,
        ],
        systemPrompt: options?.systemPrompt,
      });

      const result = await agent.invoke(
        { messages: [{ role: 'user', content: appendOutputStyleToPrompt(prompt, options?.outputStyle) }] },
        {
          signal: this.abortController?.signal,
          recursionLimit: options?.maxTurns ? Math.max(2, options.maxTurns * 2 + 1) : undefined,
        },
      );

      const text = extractFinalText(result);
      const usage = extractUsage(result);
      if (text) {
        output.push(text);
        options?.onEvent?.({ type: 'output', line: text });
      }
      if (usage?.totalTokens || usage?.inputTokens || usage?.outputTokens) {
        const usageLine = `[Usage] tokens=${usage.totalTokens ?? '-'} input=${usage.inputTokens ?? '-'} output=${usage.outputTokens ?? '-'}`;
        output.push(usageLine);
        options?.onEvent?.({ type: 'output', line: usageLine });
      }

      const elapsed = Date.now() - startTime;
      d(`done ${elapsed}ms | tokens=${usage?.totalTokens ?? 'unknown'}`);

      return {
        success: true,
        summary: summarizeResult(text),
        artifacts: [],
        output,
        usage,
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      d(`failed ${elapsed}ms | ${message}`);
      if (err instanceof Error && err.stack) console.error(err.stack);

      return { success: false, summary: 'LangChain execution failed', artifacts: [], error: message, output };
    } finally {
      if (mcpClient) {
        await mcpClient.close();
        d('MCP client closed');
      }
      this.abortController = null;
    }
  }

  stop(): void {
    this.abortController?.abort();
  }
}

function buildLangChainTools(
  functionTools: AgentFunctionTool[] | undefined,
  output: string[],
  options: AgentRunOptions | undefined,
  log: (message: string) => void,
): NonNullable<CreateAgentParams['tools']> {
  if (!functionTools?.length) return [];
  return functionTools.map((runtimeTool) => tool(
    async (input: unknown) => {
      const line = `Tool: ${runtimeTool.name} input=${JSON.stringify(input)}`;
      log(`tool use | name=${runtimeTool.name} input=${summarizeForLog(input, 800)}`);
      output.push(line);
      options?.onEvent?.({ type: 'tool_use', id: runtimeTool.name, name: runtimeTool.name, input, line });
      try {
        const result = await runtimeTool.execute(input);
        log(`tool result | name=${runtimeTool.name} output=${summarizeForLog(result, 1000)}`);
        options?.onEvent?.({ type: 'tool_result', toolUseId: runtimeTool.name, result });
        return stringifyToolResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`tool error | name=${runtimeTool.name} error=${truncateForLog(message, 1000)}`);
        throw err;
      }
    },
    {
      name: runtimeTool.name,
      description: runtimeTool.description,
      schema: z.object({}).passthrough(),
    },
  )) as NonNullable<CreateAgentParams['tools']>;
}

interface LangChainModelSettings {
  provider?: string;
  modelIdentifier: string;
  providerCorrectionReason?: string;
}

export function resolveLangChainModelSettings(config: AgentRuntimeConfig): LangChainModelSettings {
  const model = config.model || 'gpt-4o-mini';
  const configuredProvider = normalizeLangChainProvider(config.provider);
  const inferredProvider = inferLangChainProviderFromBaseURL(config.baseURL);
  const provider = configuredProvider === 'anthropic' && inferredProvider === 'openai'
    ? inferredProvider
    : configuredProvider;
  const plainModel = provider ? stripLangChainProviderPrefix(model) : model;
  const providerCorrectionReason = provider !== configuredProvider
    ? `baseURL=${config.baseURL} is OpenAI-compatible, using ${provider} instead of ${configuredProvider}`
    : undefined;

  return {
    provider,
    modelIdentifier: provider ? `${provider}:${plainModel}` : plainModel,
    providerCorrectionReason,
  };
}

function normalizeLangChainProvider(provider?: AgentRuntimeConfig['provider']): string | undefined {
  switch (provider) {
    case 'anthropic-messages':
      return 'anthropic';
    case 'openai-chat-completions':
    case 'openai-responses':
      return 'openai';
    case 'gemini-generate-content':
      return 'google-genai';
    default:
      return undefined;
  }
}

function buildModelConfig(config: AgentRuntimeConfig): Record<string, unknown> {
  return removeUndefined({
    apiKey: config.apiKey,
    api_key: config.apiKey,
    baseURL: config.baseURL,
    baseUrl: config.baseURL,
    configuration: config.baseURL ? { baseURL: config.baseURL } : undefined,
  });
}

function inferLangChainProviderFromBaseURL(baseURL?: string): string | undefined {
  if (!baseURL) return undefined;
  try {
    const hostname = new URL(baseURL).hostname.toLowerCase();
    if (hostname === 'open.bigmodel.cn' || hostname.endsWith('.bigmodel.cn')) return 'openai';
  } catch {
    return undefined;
  }
  return undefined;
}

function stripLangChainProviderPrefix(model: string): string {
  const match = /^(anthropic|openai|google-genai):(.+)$/i.exec(model);
  return match?.[2] || model;
}

export function stringifyToolResult(result: unknown): string {
  if (result === undefined) return 'null';
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result, null, 2) ?? String(result);
  } catch {
    return String(result);
  }
}

function createLangChainMcpClient(
  mcpServers: Record<string, unknown> | undefined,
  output: string[],
  options: AgentRunOptions | undefined,
  log: (message: string) => void,
): MultiServerMCPClient | undefined {
  const normalizedMcpServers = normalizeLangChainMcpServers(mcpServers);
  if (!normalizedMcpServers) return undefined;
  return new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: 'mcp',
    useStandardContentBlocks: false,
    outputHandling: 'content',
    mcpServers: normalizedMcpServers,
    beforeToolCall: (request) => {
      const name = formatMcpToolName(request.serverName, request.name);
      const line = `Tool: ${name} input=${JSON.stringify(request.args ?? {})}`;
      log(`tool use | name=${name} input=${summarizeForLog(request.args ?? {}, 800)}`);
      output.push(line);
      options?.onEvent?.({ type: 'tool_use', id: name, name, input: request.args ?? {}, line });
    },
    afterToolCall: (result) => {
      const name = formatMcpToolName(result.serverName, result.name);
      const outputText = stringifyToolResult(result.result);
      log(`tool result | name=${name} output=${truncateForLog(outputText, 1000)}`);
      options?.onEvent?.({ type: 'tool_result', toolUseId: name, result: outputText });
      return { result: outputText };
    },
    onProgress: (progress, source) => {
      if (source.type !== 'tool') return;
      const name = formatMcpToolName(source.server, source.name);
      const progressText = progress.total
        ? `${progress.progress}/${progress.total}`
        : String(progress.progress);
      log(`tool progress | name=${name} progress=${progressText}${progress.message ? ` message=${truncateForLog(progress.message, 300)}` : ''}`);
    },
    onMessage: (message, source) => {
      log(`mcp message | server=${source.server} level=${message.level ?? '-'} data=${summarizeForLog(message.data, 500)}`);
    },
  });
}

export function normalizeLangChainMcpServers(
  mcpServers: Record<string, unknown> | undefined,
): Record<string, Connection> | undefined {
  if (!mcpServers || Object.keys(mcpServers).length === 0) return undefined;
  return Object.fromEntries(
    Object.entries(mcpServers).map(([name, server]) => [name, normalizeLangChainMcpServer(server)]),
  );
}

function normalizeLangChainMcpServer(server: unknown): Connection {
  if (!isRecord(server)) {
    throw new Error('MCP server config must be an object.');
  }
  const normalized = normalizeOpenAgentCompatibleFetchMcpServer(server);
  if (typeof normalized.url === 'string') {
    return removeUndefined({
      ...normalized,
      transport: normalized.transport === 'sse' || normalized.type === 'sse' ? 'sse' : 'http',
      url: normalized.url,
      headers: isStringRecord(normalized.headers) ? normalized.headers : undefined,
    }) as Connection;
  }
  if (typeof normalized.command === 'string') {
    return removeUndefined({
      ...normalized,
      transport: 'stdio',
      command: normalized.command,
      args: Array.isArray(normalized.args) ? normalized.args.map(String) : [],
      env: isStringRecord(normalized.env) ? normalized.env : undefined,
      cwd: typeof normalized.cwd === 'string' ? normalized.cwd : undefined,
    }) as Connection;
  }
  throw new Error('MCP server config requires either url or command.');
}

function normalizeOpenAgentCompatibleFetchMcpServer(server: Record<string, unknown>): Record<string, unknown> {
  const args = Array.isArray(server.args) ? server.args.map(String) : undefined;
  const badFetchPackageIndex = args?.indexOf('@modelcontextprotocol/server-fetch') ?? -1;
  if (String(server.command) !== 'npx' || !args || badFetchPackageIndex < 0) return server;
  return {
    ...server,
    command: 'uvx',
    args: ['mcp-server-fetch', ...args.slice(badFetchPackageIndex + 1)],
    env: {
      PYTHONIOENCODING: 'utf-8',
      ...(isStringRecord(server.env) ? server.env : {}),
    },
  };
}

function formatMcpToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

function summarizeForLog(value: unknown, maxLength = 300): string {
  if (typeof value === 'string') return truncateForLog(value, maxLength);
  return truncateForLog(stringifyToolResult(value), maxLength);
}

function truncateForLog(value: string, maxLength = 300): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildProviderEnv(config: AgentRuntimeConfig, resolvedProvider?: string): Record<string, string | undefined> {
  const provider = resolvedProvider ?? normalizeLangChainProvider(config.provider);
  return {
    OPENAI_API_KEY: provider === 'openai' ? config.apiKey : undefined,
    OPENAI_BASE_URL: provider === 'openai' ? config.baseURL : undefined,
    ANTHROPIC_API_KEY: provider === 'anthropic' ? config.apiKey : undefined,
    ANTHROPIC_BASE_URL: provider === 'anthropic' ? config.baseURL : undefined,
    GOOGLE_API_KEY: provider === 'google-genai' ? config.apiKey : undefined,
    GEMINI_API_KEY: provider === 'google-genai' ? config.apiKey : undefined,
  };
}

async function withTemporaryEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function extractFinalText(result: unknown): string {
  const messages = isRecord(result) && Array.isArray(result.messages) ? result.messages : [];
  const last = [...messages].reverse().find((message) => isRecord(message) && getMessageType(message) === 'ai')
    ?? messages.at(-1);
  return stringifyMessageContent(isRecord(last) ? last.content : undefined);
}

function getMessageType(message: Record<string, unknown>): string | undefined {
  const getType = message._getType;
  return typeof getType === 'function' ? getType.call(message) : undefined;
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : JSON.stringify(content);
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!isRecord(part)) return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function extractUsage(result: unknown): AgentRunResult['usage'] {
  const messages = isRecord(result) && Array.isArray(result.messages) ? result.messages : [];
  for (const message of [...messages].reverse()) {
    if (!isRecord(message)) continue;
    const usage = isRecord(message.usage_metadata)
      ? message.usage_metadata
      : isRecord(message.response_metadata) && isRecord(message.response_metadata.tokenUsage)
        ? message.response_metadata.tokenUsage
        : undefined;
    if (!usage) continue;
    const inputTokens = numberFrom(usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens);
    const outputTokens = numberFrom(usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens);
    const totalTokens = numberFrom(usage.total_tokens ?? usage.totalTokens) ?? (
      inputTokens !== undefined || outputTokens !== undefined ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined
    );
    return removeUndefined({ inputTokens, outputTokens, totalTokens });
  }
  return undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
