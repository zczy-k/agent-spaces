import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, delimiter, extname, join } from 'node:path';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';

/**
 * Runtime backed by the external Hermes CLI.
 *
 * Hermes does not currently expose a structured JS SDK here, so this adapter
 * classifies CLI text output before forwarding it to the UI.
 */
export class HermesRuntime implements AgentRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly config: AgentRuntimeConfig = {}) {}

  async execute(prompt: string, workingDir: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    const output: string[] = [];
    const cwd = workingDir || process.cwd();
    const startTime = Date.now();
    const d = (message: string) => console.log(`[hermes] ${truncateConsoleMessage(message)}`);
    const agentDir = options?.configDir;
    const hermesHome = agentDir ? join(agentDir, '.hermes') : undefined;
    if (hermesHome) prepareHermesHome(hermesHome, this.config, agentDir);

    const args = buildHermesArgs(appendOutputStyleToPrompt(prompt, options?.outputStyle), this.config, options);
    const cliProvider = getHermesCliProvider(this.config.provider);
    d(`starting | cwd=${cwd} model=${this.config.model ?? 'profile-default'} provider=${cliProvider ?? 'profile-default'} requestedProvider=${this.config.provider ?? 'profile-default'} hermesHome=${hermesHome ?? 'default'} skills=${options?.skills?.join(',') || '-'}`);

    return new Promise<AgentRunResult>((resolve) => {
      let settled = false;
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let sessionId = options?.resumeSessionId;
      let emittedSessionId = sessionId;
      const lineParser = createHermesLineParser(output, options);

      const finish = (result: AgentRunResult): void => {
        if (settled) return;
        settled = true;
        this.child = null;
        resolve(result);
      };

      try {
        this.child = spawn(resolveHermesCommand(), args, {
          cwd,
          env: buildEnv(this.config, hermesHome),
          windowsHide: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        d(`failed to start | ${message}`);
        finish({
          success: false,
          summary: 'Hermes execution failed',
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
          d(`stdout | ${line}`);
          const parsedSessionId = extractSessionId(line);
          if (parsedSessionId && parsedSessionId !== emittedSessionId) {
            sessionId = parsedSessionId;
            emittedSessionId = parsedSessionId;
            options?.onEvent?.({ type: 'session', sessionId });
          }
          lineParser.handleLine(line, 'stdout');
        });
      });

      this.child.stderr.on('data', (chunk: string) => {
        stderrBuffer = consumeLines(stderrBuffer + chunk, (line) => {
          if (!line) return;
          d(`stderr | ${line}`);
          lineParser.handleLine(line, 'stderr');
        });
      });

      this.child.on('error', (err) => {
        const message = err.message.includes('ENOENT')
          ? 'Hermes CLI was not found. Install Hermes and ensure the `hermes` command is available on PATH.'
          : err.message;
        d(`failed ${Date.now() - startTime}ms | ${message}`);
        finish({
          success: false,
          summary: 'Hermes execution failed',
          artifacts: [],
          error: message,
          output,
          sessionId,
        });
      });

      this.child.on('close', (code, signal) => {
        stdoutBuffer = flushLine(stdoutBuffer, (line) => lineParser.handleLine(line, 'stdout'));
        stderrBuffer = flushLine(stderrBuffer, (line) => lineParser.handleLine(line, 'stderr'));
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
          ? `Hermes execution stopped by signal ${signal}`
          : `Hermes execution failed with exit code ${code ?? 'unknown'}`;
        d(`failed ${elapsed}ms | ${error}`);
        finish({
          success: false,
          summary: 'Hermes execution failed',
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

function buildHermesArgs(prompt: string, config: AgentRuntimeConfig, options?: AgentRunOptions): string[] {
  const args = ['chat', '-q', prompt, '--verbose'];
  for (const skill of normalizeSkillNames(options?.skills)) args.push('-s', skill);
  if (config.model) args.push('--model', config.model);
  const provider = getHermesCliProvider(config.provider);
  if (provider) args.push('--provider', provider);
  return args;
}

function getHermesCliProvider(provider: AgentRuntimeConfig['provider']): string | undefined {
  if (!provider || isAgentSpacesProtocolProvider(provider)) return undefined;
  return String(provider);
}

function isAgentSpacesProtocolProvider(provider: AgentRuntimeConfig['provider']): boolean {
  return provider === 'anthropic-messages'
    || provider === 'openai-chat-completions'
    || provider === 'openai-responses'
    || provider === 'openai-responses-to-anthropic-messages'
    || provider === 'openai-chat-completions-to-anthropic-messages'
    || provider === 'gemini-generate-content';
}

function buildEnv(config: AgentRuntimeConfig, hermesHome?: string): NodeJS.ProcessEnv {
  const apiKey = config.apiKey || process.env.HERMES_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  return {
    ...process.env,
    AGENT_SPACES_HERMES_API_KEY: apiKey,
    HERMES_HOME: hermesHome || process.env.HERMES_HOME,
    HERMES_API_KEY: apiKey,
    HERMES_BASE_URL: config.baseURL || process.env.HERMES_BASE_URL,
    OPENAI_API_KEY: config.apiKey || process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: config.baseURL || process.env.OPENAI_BASE_URL,
    ANTHROPIC_API_KEY: config.apiKey || process.env.ANTHROPIC_API_KEY,
    NO_COLOR: process.env.NO_COLOR || '1',
  };
}

function resolveHermesCommand(): string {
  const configured = process.env.HERMES_CLI_PATH?.trim();
  if (configured) return configured;
  if (process.platform !== 'win32') return 'hermes';

  const pathCommand = resolveWindowsPathCommand('hermes.exe');
  if (pathCommand) return pathCommand;

  const candidates = [
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe')
      : undefined,
    process.env.USERPROFILE
      ? join(process.env.USERPROFILE, 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe')
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? 'hermes';
}

function resolveWindowsPathCommand(command: string): string | undefined {
  const pathValue = getPathEnvValue();
  if (!pathValue) return undefined;

  for (const dir of pathValue.split(delimiter)) {
    if (!dir.trim()) continue;
    const candidate = join(dir.trim(), command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function getPathEnvValue(): string | undefined {
  return Object.entries(process.env).find(([key]) => key.toLowerCase() === 'path')?.[1];
}

function prepareHermesHome(hermesHome: string, config: AgentRuntimeConfig, agentDir?: string): void {
  mkdirSync(hermesHome, { recursive: true });
  writeManagedHermesConfig(hermesHome, config);
  const skillsDir = join(hermesHome, 'skills');
  rmSync(skillsDir, { recursive: true, force: true });
  mkdirSync(skillsDir, { recursive: true });
  if (!agentDir) return;

  const sourceSkillsDir = join(agentDir, 'skills');
  if (!existsSync(sourceSkillsDir)) return;
  for (const file of readdirSync(sourceSkillsDir)) {
    if (extname(file).toLowerCase() !== '.md') continue;
    const sourceFile = join(sourceSkillsDir, file);
    if (!statSync(sourceFile).isFile()) continue;
    copyFileSync(sourceFile, join(skillsDir, basename(file)));
  }
}

function writeManagedHermesConfig(hermesHome: string, config: AgentRuntimeConfig): void {
  if (!config.baseURL || !config.model || !isAgentSpacesProtocolProvider(config.provider)) return;

  const configPath = join(hermesHome, 'config.yaml');
  if (existsSync(configPath) && !isManagedHermesConfig(configPath)) return;

  const apiMode = getHermesApiMode(config.provider, config.baseURL);
  const lines = [
    '# Managed by Agent Spaces for this agent profile.',
    'model:',
    `  default: ${yamlString(config.model)}`,
    '  provider: custom',
    `  base_url: ${yamlString(config.baseURL)}`,
    '  api_key: ${AGENT_SPACES_HERMES_API_KEY}',
  ];
  if (apiMode) lines.push(`  api_mode: ${apiMode}`);
  writeFileSync(configPath, `${lines.join('\n')}\n`, 'utf-8');
}

function isManagedHermesConfig(configPath: string): boolean {
  return readFileSync(configPath, 'utf-8').startsWith('# Managed by Agent Spaces for this agent profile.');
}

function getHermesApiMode(provider: AgentRuntimeConfig['provider'], baseURL?: string): string | undefined {
  switch (provider) {
    case 'anthropic-messages':
      return isAnthropicCompatibleBaseURL(baseURL) ? 'anthropic_messages' : 'chat_completions';
    case 'openai-chat-completions':
    case 'openai-chat-completions-to-anthropic-messages':
      return 'chat_completions';
    case 'openai-responses':
    case 'openai-responses-to-anthropic-messages':
      return 'codex_responses';
    default:
      return undefined;
  }
}

function isAnthropicCompatibleBaseURL(baseURL?: string): boolean {
  if (!baseURL) return false;
  try {
    const url = new URL(baseURL);
    return url.hostname.toLowerCase().endsWith('anthropic.com')
      || url.pathname.toLowerCase().split('/').includes('anthropic');
  } catch {
    return false;
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function truncateConsoleMessage(message: string): string {
  const maxLength = 600;
  if (message.length <= maxLength) return message;
  return `${message.slice(0, maxLength)}... [truncated ${message.length - maxLength} chars]`;
}

function consumeLines(buffer: string, onLine: (line: string) => void): string {
  const lines = buffer.split(/\r?\n/);
  const remainder = lines.pop() ?? '';
  for (const line of lines) onLine(stripAnsi(line).trimEnd());
  return remainder;
}

function flushLine(buffer: string, onLine: (line: string) => void): string {
  const line = stripAnsi(buffer).trimEnd();
  if (line) onLine(line);
  return '';
}

function extractSessionId(line: string): string | undefined {
  const match = line.match(/\bsession(?:\s+id)?\s*[:=]\s*([a-zA-Z0-9._:-]+)/i);
  return match?.[1];
}

function normalizeSkillNames(skills?: string[]): string[] {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((skill) => basename(skill).replace(/\.md$/i, '').trim())
    .filter(Boolean);
}

function lastMeaningfulLine(output: string[]): string {
  return [...output].reverse().find((line) => line.trim() && !isDiagnosticOutputLine(line)) ?? '';
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

type HermesLineSource = 'stdout' | 'stderr';

interface HermesLineParser {
  handleLine(line: string, source: HermesLineSource): void;
}

function createHermesLineParser(output: string[], options?: AgentRunOptions): HermesLineParser {
  let inEchoedQuery = false;
  let inRuntimeConfig = false;
  let inUserMessageEcho = false;
  let inVerboseArgsBlock = false;
  let inVerboseResultBlock = false;
  let inVerboseThinkingBlock = false;
  let toolUseIndex = 0;
  let emittedUsage = false;

  const emitOutput = (line: string): void => {
    output.push(line);
    options?.onEvent?.({ type: 'output', line });
  };

  const emitUsage = (usageLine: string): void => {
    if (emittedUsage) return;
    emittedUsage = true;
    emitOutput(usageLine);
  };

  const emitToolUse = (tool: { name: string; input?: unknown; rawInput?: string }): void => {
    toolUseIndex += 1;
    const id = `hermes-tool-${toolUseIndex}`;
    const line = tool.rawInput ? `Tool: ${tool.name} ${tool.rawInput}` : `Tool: ${tool.name}`;
    options?.onEvent?.({
      type: 'tool_use',
      id,
      name: tool.name,
      input: tool.input,
      line,
    });
  };

  return {
    handleLine(line, source) {
      const normalized = line.trim();
      if (!normalized) return;

      const toolUse = parseHermesToolUse(normalized);
      if (toolUse) {
        emitToolUse(toolUse);
        return;
      }

      const usageLine = parseHermesUsageLine(normalized);
      if (usageLine) {
        emitUsage(usageLine);
        return;
      }

      const reasoning = parseHermesReasoningLine(normalized);
      if (reasoning) {
        options?.onEvent?.({ type: 'reasoning', text: reasoning, status: 'completed' });
        return;
      }

      if (source === 'stderr') return;

      if (inVerboseThinkingBlock) {
        if (!isHermesThinkingContinuationLine(normalized)) inVerboseThinkingBlock = false;
        else return;
      }

      if (inVerboseResultBlock) {
        if (isHermesVerboseBlockBoundaryLine(normalized)) inVerboseResultBlock = false;
        else {
          if (normalized.endsWith('}')) inVerboseResultBlock = false;
          return;
        }
      }

      if (inVerboseArgsBlock) {
        if (normalized === '}') inVerboseArgsBlock = false;
        return;
      }

      if (inUserMessageEcho) return;

      if (/^\[thinking\]/i.test(normalized)) {
        inVerboseThinkingBlock = true;
        return;
      }

      if (/^Args:\s*\{$/i.test(normalized)) {
        inVerboseArgsBlock = true;
        return;
      }

      if (/^Result:\s*/i.test(normalized)) {
        if (!normalized.endsWith('}')) inVerboseResultBlock = true;
        return;
      }

      if (/^Query:\s*/i.test(normalized)) {
        inEchoedQuery = true;
        return;
      }

      if (inEchoedQuery && isHermesRuntimeBoundaryLine(normalized)) {
        inEchoedQuery = false;
      }

      if (/^Agent runtime configuration:\s*$/i.test(normalized)) {
        inEchoedQuery = false;
        inRuntimeConfig = true;
        return;
      }

      if (inEchoedQuery) return;

      if (inRuntimeConfig) {
        if (/^User message:\s*$/i.test(normalized)) {
          inRuntimeConfig = false;
          inUserMessageEcho = true;
          return;
        }
        if (isHermesRuntimeConfigLine(normalized)) return;
        inRuntimeConfig = false;
      }

      if (isHermesNoiseLine(normalized)) return;
      emitOutput(normalized);
    },
  };
}

function parseHermesToolUse(line: string): { name: string; input?: unknown; rawInput?: string } | null {
  const match = line.match(/\bTool call:\s*([A-Za-z_][\w.-]*)\s+with args:\s*(.+)$/i);
  if (!match) return null;

  const name = match[1];
  const rawInput = match[2].replace(/\.\.\.$/, '').trim();
  return {
    name,
    rawInput,
    input: parseJsonObject(rawInput) ?? rawInput,
  };
}

function parseHermesReasoningLine(line: string): string | undefined {
  return line.match(/\b(?:Reasoning|Thinking):\s*(.+)$/i)?.[1]?.trim();
}

function parseHermesUsageLine(line: string): string | undefined {
  const apiCallMatch = line.match(/\bAPI call #\d+:.*?\bin=([\d,]+)\s+out=([\d,]+)\s+total=([\d,]+)/i);
  if (apiCallMatch) {
    const cache = line.match(/\bcache=([\d,]+)\/[\d,]+/i)?.[1];
    return formatUsageLine({
      input: apiCallMatch[1],
      output: apiCallMatch[2],
      total: apiCallMatch[3],
      cached: cache,
    });
  }

  const tokenUsageMatch = line.match(/\bToken usage:\s*prompt=([\d,]+),\s*completion=([\d,]+),\s*total=([\d,]+)/i);
  if (tokenUsageMatch) {
    return formatUsageLine({
      input: tokenUsageMatch[1],
      output: tokenUsageMatch[2],
      total: tokenUsageMatch[3],
    });
  }

  return undefined;
}

function formatUsageLine(usage: { input: string; output: string; total: string; cached?: string }): string {
  const parts = [
    `[Usage] total: ${usage.total}`,
    `input: ${usage.input}`,
    `output: ${usage.output}`,
  ];
  if (usage.cached) parts.push(`cached: ${usage.cached}`);
  return parts.join(' ');
}

function parseJsonObject(value: string): unknown | undefined {
  if (!value.startsWith('{') && !value.startsWith('[')) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isHermesNoiseLine(line: string): boolean {
  return /^\u{1f916}\s*AI Agent initialized\b/iu.test(line)
    || /^\u{1f517}\s*Using custom base URL:/iu.test(line)
    || /^\u{1f511}\s*Using API key:/iu.test(line)
    || /^\u{1f511}\s*Using token:/iu.test(line)
    || isHermesRuntimeBoundaryLine(line)
    || isHermesVerboseUiLine(line);
}

function isHermesRuntimeBoundaryLine(line: string): boolean {
  return /^Initializing agent\b/i.test(line)
    || /^\u{1f916}\s*AI Agent initialized\b/iu.test(line);
}

function isHermesRuntimeConfigLine(line: string): boolean {
  return /^-\s+/.test(line)
    || /^(skills|directory,|paths\.|tools you have,|are|built-in runtime tools|internals, previous sessions, or filesystem settings\.)$/i.test(line)
    || /^For Bash commands that create or modify files under the current working\b/i.test(line)
    || /^When asked what MCP servers, skills, runtime tools, or Agent Spaces channel\b/i.test(line)
    || /^Important distinction: MCP servers configured for this agent are only the names\b/i.test(line)
    || /^in "MCP servers configured for this agent"\./i.test(line)
    || /^Do not infer availability from provider-side function names, hidden runtime\b/i.test(line);
}

function isHermesVerboseUiLine(line: string): boolean {
  return /^[\u{2705}\u{1f6e0}\u{fe0f}\u{26a0}\u{1f512}\u{1f4be}\u{1f4ca}\u{1f4ac}\u{1f389}\u{1f4de}]/u.test(line)
    || /^[\u{2500}\u{256d}\u{2570}\u{2502}]/u.test(line)
    || /^\[thinking\]/i.test(line)
    || /^┊\s*/u.test(line)
    || /^(Tool \d+:|Args:|Result:|Resume this session with:|Session:|Duration:|Messages:)/i.test(line)
    || /^hermes\s+--resume\b/i.test(line)
    || /^\{".*"\}?$/.test(line);
}

function isHermesVerboseBlockBoundaryLine(line: string): boolean {
  return /^\[thinking\]/i.test(line)
    || /^[\u{2705}\u{1f389}\u{1f4de}]/u.test(line)
    || /^[\u{2500}\u{256d}\u{2570}\u{2502}]/u.test(line)
    || /^(Tool \d+:|Args:|Result:|Resume this session with:|Session:|Duration:|Messages:)/i.test(line)
    || /^hermes\s+--resume\b/i.test(line);
}

function isHermesThinkingContinuationLine(line: string): boolean {
  return !isHermesVerboseBlockBoundaryLine(line)
    && !/^\[Usage\]/i.test(line)
    && !/^Tool:\s*/i.test(line);
}

function isDiagnosticOutputLine(line: string): boolean {
  return line.startsWith('[stderr]')
    || /^\[Usage\]/i.test(line)
    || /^Tool:\s*/i.test(line)
    || isHermesNoiseLine(line);
}
