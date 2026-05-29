import { createAgent } from '@codeany/open-agent-sdk';
import type { Agent, ApiType, SDKMessage } from '@codeany/open-agent-sdk';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';
import { startCodexFunctionToolBridge, type CodexFunctionToolBridge } from './codex-function-tool-bridge.js';

/**
 * Runtime backed by @codeany/open-agent-sdk.
 * Runs the agent loop in-process with the SDK's built-in tools.
 */
export class OpenAgentSdkRuntime implements AgentRuntime {
  private agent: Agent | null = null;
  private abortController: AbortController | null = null;

  constructor(private readonly config: AgentRuntimeConfig = {}) {}

  async execute(prompt: string, workingDir: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    this.abortController = new AbortController();
    const output: string[] = [];
    const cwd = workingDir || process.cwd();
    const startTime = Date.now();
    const d = (msg: string) => console.log(`[agent] ${msg}`);
    let functionToolBridge: CodexFunctionToolBridge | undefined;

    d(`starting | cwd=${cwd} provider=${this.config.provider ?? 'default'} model=${this.config.model ?? 'default'} baseURL=${this.config.baseURL ?? 'default'} permissionMode=${this.config.permissionMode ?? 'bypassPermissions'} maxTurns=${options?.maxTurns ?? '∞'} allowedTools=${options?.tools?.join(',') ?? 'all'} mcpServers=${Object.keys(options?.mcpServers ?? {}).join(',') || '-'} functionTools=${options?.functionTools?.map((tool) => tool.name).join(',') || '-'} sandboxDirs=${options?.sandboxDirs?.join(',') ?? '-'}`);
    d(`prompt: ${prompt.slice(0, 300)}${prompt.length > 300 ? '...' : ''}`);

    try {
      functionToolBridge = await startCodexFunctionToolBridge(options?.functionTools, d);
      const mcpServers = withFunctionToolBridge(options?.mcpServers, functionToolBridge);
      d(`resolved tools | allowedTools=${options?.tools?.join(',') ?? 'all'} mcpServers=${Object.keys(mcpServers ?? {}).join(',') || '-'} functionTools=${options?.functionTools?.map((tool) => tool.name).join(',') || '-'}`);

      this.agent = createAgent({
        apiType: normalizeApiType(this.config.provider),
        model: this.config.model,
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        cwd,
        systemPrompt: options?.systemPrompt,
        maxTurns: options?.maxTurns,
        allowedTools: options?.tools,
        mcpServers,
        additionalDirectories: options?.sandboxDirs,
        permissionMode: this.config.permissionMode ?? 'bypassPermissions',
        abortController: this.abortController,
      });

      d('agent created, sending prompt...');
      const result = await collectQueryResult(
        this.agent.query(appendOutputStyleToPrompt(prompt, options?.outputStyle)),
        output,
        options,
        d,
      );
      const elapsed = Date.now() - startTime;
      const inputTokens = result.usage.input_tokens;
      const outputTokens = result.usage.output_tokens;
      const usage = result.usage as unknown as Record<string, unknown>;
      const cacheRead = usage.cache_read_input_tokens ?? 0;
      const cacheCreation = usage.cache_creation_input_tokens ?? 0;

      output.push(result.text);
      output.push(`[Usage] tokens=${inputTokens + outputTokens + Number(cacheRead) + Number(cacheCreation)} input=${inputTokens} output=${outputTokens} cached=${Number(cacheRead) + Number(cacheCreation)}`);
      options?.onEvent?.({ type: 'output', line: result.text });
      d(`done ${elapsed}ms | turns=${result.num_turns} tokens=${inputTokens + outputTokens} (in=${inputTokens} out=${outputTokens})${Number(cacheRead) > 0 || Number(cacheCreation) > 0 ? ` cache=(read=${cacheRead},create=${cacheCreation})` : ''}`);

      return {
        success: true,
        summary: summarizeResult(result.text),
        artifacts: [],
        output,
        usage: {
          inputTokens,
          outputTokens,
          cachedInputTokens: Number(cacheRead) + Number(cacheCreation),
          totalTokens: inputTokens + outputTokens + Number(cacheRead) + Number(cacheCreation),
        },
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      d(`failed ${elapsed}ms | ${message}`);
      if (err instanceof Error && err.stack) console.error(err.stack);

      return { success: false, summary: 'Agent execution failed', artifacts: [], error: message, output };
    } finally {
      try {
        await this.agent?.close();
      } finally {
        try {
          await functionToolBridge?.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          d(`function tool bridge close failed | ${message}`);
        }
      }
      this.agent = null;
      this.abortController = null;
    }
  }

  stop(): void {
    this.abortController?.abort();
    this.agent?.interrupt();
  }
}

function withFunctionToolBridge(
  mcpServers: Record<string, unknown> | undefined,
  bridge: CodexFunctionToolBridge | undefined,
): Record<string, unknown> | undefined {
  if (!bridge) return mcpServers;
  return {
    ...(mcpServers ?? {}),
    [bridge.name]: { type: 'http', url: bridge.url },
  };
}

async function collectQueryResult(
  events: AsyncGenerator<SDKMessage, void>,
  output: string[],
  options: AgentRunOptions | undefined,
  log: (message: string) => void,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }; num_turns: number }> {
  const collected: {
    text: string;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    num_turns: number;
  } = {
    text: '',
    usage: { input_tokens: 0, output_tokens: 0 },
    num_turns: 0,
  };

  for await (const event of events) {
    if (event.type === 'system' && event.subtype === 'init') {
      log(`sdk init | session=${event.session_id} model=${event.model} cwd=${event.cwd} permissionMode=${event.permission_mode} tools=${event.tools.join(',') || '-'} mcpServers=${event.mcp_servers.map((server) => `${server.name}:${server.status}`).join(',') || '-'}`);
      options?.onEvent?.({ type: 'session', sessionId: event.session_id });
      continue;
    }

    if (event.type === 'assistant') {
      const text = event.message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
      if (text) collected.text = text;

      for (const block of event.message.content) {
        if (block.type !== 'tool_use') continue;
        const line = `Tool: ${block.name} input=${JSON.stringify(block.input)}`;
        log(`tool use | id=${block.id} name=${block.name} input=${JSON.stringify(block.input)}`);
        output.push(line);
        options?.onEvent?.({ type: 'tool_use', id: block.id, name: block.name, input: block.input, line });
      }
      continue;
    }

    if (event.type === 'tool_result') {
      const result = event.result;
      log(`tool result | id=${result.tool_use_id} name=${result.tool_name} output=${truncateForLog(result.output)}`);
      options?.onEvent?.({ type: 'tool_result', toolUseId: result.tool_use_id, result: result.output });
      continue;
    }

    if (event.type === 'result') {
      collected.num_turns = event.num_turns ?? 0;
      collected.usage = {
        input_tokens: event.usage?.input_tokens ?? 0,
        output_tokens: event.usage?.output_tokens ?? 0,
        cache_read_input_tokens: event.usage?.cache_read_input_tokens,
        cache_creation_input_tokens: event.usage?.cache_creation_input_tokens,
      };
      if (event.is_error) {
        log(`sdk result error | subtype=${event.subtype} errors=${event.errors?.join('; ') || '-'}`);
      }
    }
  }

  return collected;
}

function truncateForLog(value: string, max = 1000): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function normalizeApiType(provider?: string): ApiType | undefined {
  if (provider === 'anthropic-messages' || provider === 'openai-completions') {
    return provider;
  }
  return undefined;
}
