import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, delimiter, extname, join } from 'node:path';
import type {
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
} from './agent-runtime-types.js';
import { appendOutputStyleToPrompt, summarizeResult } from './agent-runtime-types.js';
import { startCodexFunctionToolBridge, type CodexFunctionToolBridge } from './codex-function-tool-bridge.js';

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
    let functionToolBridge: CodexFunctionToolBridge | undefined;

    d(`starting | cwd=${cwd} provider=${this.config.provider ?? 'default'} model=${this.config.model ?? 'default'} baseURL=${this.config.baseURL ?? 'default'} maxTurns=${options?.maxTurns ?? '∞'} allowedTools=${options?.tools?.join(',') ?? 'all'} mcpServers=${Object.keys(options?.mcpServers ?? {}).join(',') || '-'} functionTools=${options?.functionTools?.map((tool) => tool.name).join(',') || '-'} skills=${options?.skills?.join(',') || '-'} sandboxDirs=${options?.sandboxDirs?.join(',') ?? '-'}`);
    d(`prompt: ${prompt.slice(0, 300)}${prompt.length > 300 ? '...' : ''}`);

    try {
      functionToolBridge = await startCodexFunctionToolBridge(options?.functionTools, d);
      const mcpServers = withFunctionToolBridge(options?.mcpServers, functionToolBridge);
      const ompHome = prepareOmpConfigHome(this.config, options, mcpServers);
      const args = buildOmpArgs(finalPrompt, this.config, options, ompHome);
      d(`resolved tools | mcpServers=${Object.keys(mcpServers ?? {}).join(',') || '-'} functionToolBridge=${functionToolBridge?.url ?? '-'}`);

      return await new Promise<AgentRunResult>((resolve) => {
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
        this.child = spawn(resolveOmpCommand(), args, {
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
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      d(`failed ${elapsed}ms | ${message}`);
      if (err instanceof Error && err.stack) console.error(err.stack);

      return {
        success: false,
        summary: 'Oh My Pi execution failed',
        artifacts: [],
        error: message,
        output,
        sessionId: options?.resumeSessionId,
      };
    } finally {
      try {
        await functionToolBridge?.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        d(`function tool bridge close failed | ${message}`);
      }
    }
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
    PI_CODING_AGENT_DIR: agentDir || process.env.PI_CODING_AGENT_DIR,
    OPENAI_API_KEY: config.provider === 'anthropic-messages' ? process.env.OPENAI_API_KEY : apiKey,
    ANTHROPIC_API_KEY: config.provider === 'anthropic-messages' ? apiKey : process.env.ANTHROPIC_API_KEY,
    OPENAI_BASE_URL: config.baseURL || process.env.OPENAI_BASE_URL,
    ANTHROPIC_BASE_URL: config.baseURL || process.env.ANTHROPIC_BASE_URL,
    PI_AGENT_DIR: agentDir || process.env.PI_AGENT_DIR,
    OMP_AGENT_DIR: agentDir || process.env.OMP_AGENT_DIR,
    NO_COLOR: process.env.NO_COLOR || '1',
  });
}

function resolveOmpCommand(): string {
  const configured = process.env.OMP_CLI_PATH?.trim();
  if (configured) return configured;
  if (process.platform !== 'win32') return 'omp';

  const pathCommand = resolveWindowsPathCommand('omp.exe');
  if (pathCommand) return pathCommand;

  const candidates = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'omp', 'omp.exe') : undefined,
    process.env.USERPROFILE ? join(process.env.USERPROFILE, 'AppData', 'Local', 'omp', 'omp.exe') : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? 'omp';
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

function prepareOmpConfigHome(
  config: AgentRuntimeConfig,
  options?: AgentRunOptions,
  mcpServers?: Record<string, unknown>,
): string | undefined {
  if (!options?.configDir) return undefined;

  const homeDir = join(options.configDir, 'omp-home');
  const agentDir = join(homeDir, '.omp', 'agent');
  mkdirSync(agentDir, { recursive: true });
  copySkillsToOmpAgentDir(options.configDir, agentDir, options.skills);

  writeFileSync(join(agentDir, 'config.yml'), buildOmpConfigYaml(config), 'utf-8');
  const modelsYaml = buildOmpModelsYaml(config);
  if (modelsYaml) writeFileSync(join(agentDir, 'models.yml'), modelsYaml, 'utf-8');
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    writeFileSync(join(agentDir, 'mcp.json'), JSON.stringify({ mcpServers }, null, 2), 'utf-8');
  }

  return homeDir;
}

function copySkillsToOmpAgentDir(sourceAgentDir: string, targetAgentDir: string, requestedSkills?: string[]): void {
  const sourceSkillsDir = join(sourceAgentDir, 'skills');
  const targetSkillsDir = join(targetAgentDir, 'skills');
  const copied = new Set<string>();
  rmSync(targetSkillsDir, { recursive: true, force: true });
  mkdirSync(targetSkillsDir, { recursive: true });

  if (existsSync(sourceSkillsDir)) {
    for (const entry of readdirSync(sourceSkillsDir)) {
      const source = join(sourceSkillsDir, entry);
      const skillName = copySkillSource(source, entry, targetSkillsDir);
      if (skillName) copied.add(skillName);
    }
  }

  for (const skill of normalizeSkillNames(requestedSkills)) {
    if (copied.has(skill)) continue;
    const fallback = findFallbackSkillSource(sourceAgentDir, skill);
    if (!fallback) continue;
    const skillName = copySkillSource(fallback, skill, targetSkillsDir);
    if (skillName) copied.add(skillName);
  }
}

function copySkillSource(source: string, entry: string, targetSkillsDir: string): string | undefined {
  if (!existsSync(source)) return undefined;
  const sourceStat = statSync(source);

  if (sourceStat.isDirectory()) {
    const skillName = sanitizeSkillName(entry);
    if (!skillName) return undefined;
    const sourceSkillFile = join(source, 'SKILL.md');
    if (!existsSync(sourceSkillFile) || statSync(sourceSkillFile).size === 0) return undefined;
    cpSync(source, join(targetSkillsDir, skillName), { recursive: true, force: true });
    return skillName;
  }

  if (!sourceStat.isFile() || extname(entry).toLowerCase() !== '.md' || sourceStat.size === 0) return undefined;
  const skillName = sanitizeSkillName(entry);
  if (!skillName) return undefined;
  const targetSkillDir = join(targetSkillsDir, skillName);
  mkdirSync(targetSkillDir, { recursive: true });
  writeFileSync(join(targetSkillDir, 'SKILL.md'), readFileSync(source, 'utf-8'), 'utf-8');
  copyFileSync(source, join(targetSkillsDir, `${skillName}.md`));
  return skillName;
}

function findFallbackSkillSource(sourceAgentDir: string, skill: string): string | undefined {
  const workspaceAgentspaceDir = join(sourceAgentDir, '..', '..');
  const candidates = [
    join(workspaceAgentspaceDir, 'skills', skill),
    join(workspaceAgentspaceDir, 'skills', `${skill}.md`),
    join(process.cwd(), 'skills', skill),
    join(process.cwd(), 'skills', `${skill}.md`),
    ...builtInSkillCandidates(skill),
  ];

  return candidates.find(isReadableSkillSource);
}

function builtInSkillCandidates(skill: string): string[] {
  const roots = [
    join(process.cwd(), 'packages', 'agents', 'skills'),
    join(import.meta.dirname ?? '', '..', '..', '..', 'agents', 'skills'),
  ];
  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(join(root, skill), join(root, `${skill}.md`), join(root, 'superpowers', skill));
    if (!existsSync(root)) continue;
    for (const group of readdirSync(root)) {
      const groupDir = join(root, group);
      if (existsSync(groupDir) && statSync(groupDir).isDirectory()) {
        candidates.push(join(groupDir, skill), join(groupDir, `${skill}.md`));
      }
    }
  }
  return candidates;
}

function isReadableSkillSource(source: string): boolean {
  if (!existsSync(source)) return false;
  const sourceStat = statSync(source);
  if (sourceStat.isDirectory()) {
    const skillFile = join(source, 'SKILL.md');
    return existsSync(skillFile) && statSync(skillFile).size > 0;
  }
  return sourceStat.isFile() && extname(source).toLowerCase() === '.md' && sourceStat.size > 0;
}

function withFunctionToolBridge(
  mcpServers: Record<string, unknown> | undefined,
  bridge: CodexFunctionToolBridge | undefined,
): Record<string, unknown> | undefined {
  if (!bridge) return mcpServers;
  return {
    ...(mcpServers ?? {}),
    [bridge.name]: { url: bridge.url, type: 'http' },
  };
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

function sanitizeSkillName(name: string): string {
  const raw = basename(name).replace(/\.md$/i, '').trim();
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
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
