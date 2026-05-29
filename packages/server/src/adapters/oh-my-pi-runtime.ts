import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';

/**
 * Runtime backed by the external `omp` CLI.
 *
 * The published @oh-my-pi/pi-coding-agent SDK is Bun-native, so the Node server
 * keeps OMP behind a process boundary and talks to the CLI instead of importing
 * the SDK into this process.
 */
export class OhMyPiRuntime implements AgentRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly config: AgentRuntimeConfig = {}) {}

  async execute(prompt: string, workingDir: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    const output: string[] = [];
    const cwd = workingDir || process.cwd();
    const startTime = Date.now();
    const d = (message: string) => console.log(`[oh-my-pi] ${message}`);
    const finalPrompt = appendOutputStyleToPrompt(prompt, options?.outputStyle);
    const ompHome = prepareOmpConfigHome(this.config, options);
    const args = buildOmpArgs(finalPrompt, this.config, options, ompHome);

    d(`starting | cwd=${cwd} provider=${this.config.provider ?? 'default'} model=${this.config.model ?? 'default'} baseURL=${this.config.baseURL ?? 'default'} maxTurns=${options?.maxTurns ?? '∞'} allowedTools=${options?.tools?.join(',') ?? 'all'} mcpServers=${Object.keys(options?.mcpServers ?? {}).join(',') || '-'} functionTools=${options?.functionTools?.map((tool) => tool.name).join(',') || '-'} skills=${options?.skills?.join(',') || '-'} sandboxDirs=${options?.sandboxDirs?.join(',') ?? '-'}`);
    d(`prompt: ${prompt.slice(0, 300)}${prompt.length > 300 ? '...' : ''}`);
    if (options?.functionTools?.length) {
      d('function tools are not injected directly in OMP CLI mode; configure them through OMP MCP discovery if needed');
    }

    return new Promise<AgentRunResult>((resolve) => {
      let settled = false;
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let sessionId = options?.resumeSessionId;
      let emittedSessionId = sessionId;

      const finish = (result: AgentRunResult): void => {
        if (settled) return;
        settled = true;
        this.child = null;
        resolve(result);
      };

      try {
        this.child = spawn('omp', args, {
          cwd,
          env: buildEnv(this.config, options, ompHome),
          windowsHide: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        d(`failed to start | ${message}`);
        finish({
          success: false,
          summary: 'Oh My Pi execution failed',
          artifacts: [],
          error: message,
          output,
          sessionId,
        });
        return;
      }

      this.child.stdout.setEncoding('utf-8');
      this.child.stderr.setEncoding('utf-8');

      this.child.stdout.on('data', (chunk: string) => {
        stdoutBuffer = consumeLines(stdoutBuffer + chunk, (line) => {
          if (!line) return;
          output.push(line);
          const parsedSessionId = extractSessionId(line);
          if (parsedSessionId && parsedSessionId !== emittedSessionId) {
            sessionId = parsedSessionId;
            emittedSessionId = parsedSessionId;
            options?.onEvent?.({ type: 'session', sessionId });
          }
          options?.onEvent?.({ type: 'output', line });
        });
      });

      this.child.stderr.on('data', (chunk: string) => {
        stderrBuffer = consumeLines(stderrBuffer + chunk, (line) => {
          if (!line) return;
          const formatted = `[stderr] ${line}`;
          output.push(formatted);
          options?.onEvent?.({ type: 'output', line: formatted });
        });
      });

      this.child.on('error', (err) => {
        const message = err.message.includes('ENOENT')
          ? 'Oh My Pi CLI was not found. Install OMP and ensure the `omp` command is available on PATH.'
          : err.message;
        d(`failed ${Date.now() - startTime}ms | ${message}`);
        finish({
          success: false,
          summary: 'Oh My Pi execution failed',
          artifacts: [],
          error: message,
          output,
          sessionId,
        });
      });

      this.child.on('close', (code, signal) => {
        stdoutBuffer = flushLine(stdoutBuffer, output, options);
        stderrBuffer = flushLine(stderrBuffer, output, options, '[stderr] ');
        void stdoutBuffer;
        void stderrBuffer;

        const elapsed = Date.now() - startTime;
        if (code === 0) {
          const text = lastMeaningfulLine(output);
          d(`done ${elapsed}ms`);
          finish({
            success: true,
            summary: summarizeResult(text),
            artifacts: [],
            output,
            sessionId,
          });
          return;
        }

        const error = signal
          ? `Oh My Pi execution stopped by signal ${signal}`
          : `Oh My Pi execution failed with exit code ${code ?? 'unknown'}`;
        d(`failed ${elapsed}ms | ${error}`);
        finish({
          success: false,
          summary: 'Oh My Pi execution failed',
          artifacts: [],
          error,
          output,
          sessionId,
        });
      });
    });
  }

  stop(): void {
    this.child?.kill();
  }
}

function buildOmpArgs(
  prompt: string,
  config: AgentRuntimeConfig,
  options?: AgentRunOptions,
  ompHome?: string,
): string[] {
  const args = ['--mode', 'text'];

  if (options?.resumeSessionId) args.push('--resume', options.resumeSessionId);
  if (config.model) args.push('--model', config.model);
  if (config.provider) args.push('--provider', String(config.provider));
  if (config.apiKey) args.push('--api-key', config.apiKey);

  const thinking = normalizeThinkingLevel(config);
  if (thinking) args.push('--thinking', thinking);

  if (options?.tools?.length) args.push('--tools', options.tools.join(','));
  if (options?.systemPrompt?.trim()) args.push('--system-prompt', options.systemPrompt.trim());

  const skills = normalizeSkillNames(options?.skills);
  if (skills.length) args.push('--skills', skills.join(','));

  const agentDir = ompAgentDir(ompHome, options);
  if (agentDir) args.push('--session-dir', join(agentDir, 'sessions'));

  args.push('-p', prompt);
  return args;
}

function buildEnv(config: AgentRuntimeConfig, options?: AgentRunOptions, ompHome?: string): NodeJS.ProcessEnv {
  const apiKey = config.apiKey || process.env.PI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const agentDir = ompAgentDir(ompHome, options);
  return removeUndefined({
    ...process.env,
    HOME: ompHome || process.env.HOME,
    AGENT_SPACES_OMP_API_KEY: apiKey,
    PI_API_KEY: apiKey,
    OMP_API_KEY: apiKey,
    OPENAI_API_KEY: config.provider === 'anthropic-messages' ? process.env.OPENAI_API_KEY : apiKey,
    ANTHROPIC_API_KEY: config.provider === 'anthropic-messages' ? apiKey : process.env.ANTHROPIC_API_KEY,
    OPENAI_BASE_URL: config.baseURL || process.env.OPENAI_BASE_URL,
    ANTHROPIC_BASE_URL: config.baseURL || process.env.ANTHROPIC_BASE_URL,
    PI_AGENT_DIR: agentDir || process.env.PI_AGENT_DIR,
    OMP_AGENT_DIR: agentDir || process.env.OMP_AGENT_DIR,
    NO_COLOR: process.env.NO_COLOR || '1',
  });
}

function prepareOmpConfigHome(config: AgentRuntimeConfig, options?: AgentRunOptions): string | undefined {
  if (!options?.configDir) return undefined;

  const homeDir = join(options.configDir, 'omp-home');
  const agentDir = join(homeDir, '.omp', 'agent');
  mkdirSync(agentDir, { recursive: true });

  writeFileSync(join(agentDir, 'config.yml'), buildOmpConfigYaml(config), 'utf-8');
  const modelsYaml = buildOmpModelsYaml(config);
  if (modelsYaml) writeFileSync(join(agentDir, 'models.yml'), modelsYaml, 'utf-8');

  return homeDir;
}

function ompAgentDir(ompHome: string | undefined, options?: AgentRunOptions): string | undefined {
  if (ompHome) return join(ompHome, '.omp', 'agent');
  return options?.configDir;
}

function buildOmpConfigYaml(config: AgentRuntimeConfig): string {
  const model = config.provider && config.model ? `${sanitizeProviderName(config.provider)}/${config.model}` : config.model;
  const modelRoles = model ? `modelRoles:\n  default: ${yamlScalar(model)}\n` : '';
  const thinking = normalizeThinkingLevel(config);
  const thinkingLine = thinking ? `defaultThinkingLevel: ${yamlScalar(thinking)}\n` : '';
  return `${modelRoles}${thinkingLine}`;
}

function buildOmpModelsYaml(config: AgentRuntimeConfig): string | undefined {
  if (!config.model || !config.baseURL) return undefined;

  const providerName = sanitizeProviderName(config.provider);
  const api = normalizeOmpApi(config.provider);
  const apiKeyRef = config.apiKey ? 'AGENT_SPACES_OMP_API_KEY' : undefined;
  const lines = [
    'providers:',
    `  ${yamlKey(providerName)}:`,
    `    baseUrl: ${yamlScalar(config.baseURL)}`,
    `    api: ${yamlScalar(api)}`,
  ];

  if (apiKeyRef) lines.push(`    apiKey: ${yamlScalar(apiKeyRef)}`);
  else lines.push('    auth: none');

  lines.push(
    '    models:',
    `      - id: ${yamlScalar(config.model)}`,
    `        name: ${yamlScalar(config.model)}`,
    `        api: ${yamlScalar(api)}`,
    `        reasoning: ${config.thinkingEnabled === false ? 'false' : 'true'}`,
    '        input: [text]',
    '        cost:',
    '          input: 0',
    '          output: 0',
    '          cacheRead: 0',
    '          cacheWrite: 0',
    '        contextWindow: 128000',
    '        maxTokens: 16384',
    '',
  );

  return lines.join('\n');
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

function yamlKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : yamlScalar(value);
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function normalizeThinkingLevel(config: AgentRuntimeConfig): string | undefined {
  if (config.thinkingEnabled === false) return 'off';
  return config.thinkingEffort ?? 'medium';
}

function normalizeSkillNames(skills?: string[]): string[] {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function consumeLines(buffer: string, onLine: (line: string) => void): string {
  const lines = buffer.split(/\r?\n/);
  const remainder = lines.pop() ?? '';
  for (const line of lines) onLine(stripAnsi(line).trimEnd());
  return remainder;
}

function flushLine(buffer: string, output: string[], options?: AgentRunOptions, prefix = ''): string {
  const line = stripAnsi(buffer).trimEnd();
  if (line) {
    const formatted = `${prefix}${line}`;
    output.push(formatted);
    options?.onEvent?.({ type: 'output', line: formatted });
  }
  return '';
}

function extractSessionId(line: string): string | undefined {
  const match = line.match(/\bsession(?:\s+id)?\s*[:=]\s*([a-zA-Z0-9._:/-]+)/i);
  return match?.[1];
}

function lastMeaningfulLine(output: string[]): string {
  return [...output].reverse().find((line) => line.trim() && !line.startsWith('[stderr]')) ?? '';
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function removeUndefined(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}
