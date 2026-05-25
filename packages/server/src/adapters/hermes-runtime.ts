import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
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
 * treats verbose CLI output as the source of truth and streams it as text.
 */
export class HermesRuntime implements AgentRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly config: AgentRuntimeConfig = {}) {}

  async execute(prompt: string, workingDir: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    const output: string[] = [];
    const cwd = workingDir || process.cwd();
    const startTime = Date.now();
    const d = (message: string) => console.log(`[hermes] ${message}`);
    const agentDir = options?.configDir;
    const hermesHome = agentDir ? join(agentDir, '.hermes') : undefined;
    if (hermesHome) prepareHermesHome(hermesHome, agentDir);

    const args = buildHermesArgs(appendOutputStyleToPrompt(prompt, options?.outputStyle), this.config, options);
    d(`starting | cwd=${cwd} model=${this.config.model ?? 'profile-default'} provider=${this.config.provider ?? 'profile-default'} hermesHome=${hermesHome ?? 'default'} skills=${options?.skills?.join(',') || '-'}`);

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
        this.child = spawn('hermes', args, {
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
        stdoutBuffer = flushLine(stdoutBuffer, output, options);
        stderrBuffer = flushLine(stderrBuffer, output, options, '[stderr] ');
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
  if (config.provider) args.push('--provider', String(config.provider));
  return args;
}

function buildEnv(config: AgentRuntimeConfig, hermesHome?: string): NodeJS.ProcessEnv {
  const apiKey = config.apiKey || process.env.HERMES_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  return {
    ...process.env,
    HERMES_HOME: hermesHome || process.env.HERMES_HOME,
    HERMES_API_KEY: apiKey,
    HERMES_BASE_URL: config.baseURL || process.env.HERMES_BASE_URL,
    OPENAI_API_KEY: config.apiKey || process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: config.baseURL || process.env.OPENAI_BASE_URL,
    ANTHROPIC_API_KEY: config.apiKey || process.env.ANTHROPIC_API_KEY,
    NO_COLOR: process.env.NO_COLOR || '1',
  };
}

function prepareHermesHome(hermesHome: string, agentDir?: string): void {
  mkdirSync(hermesHome, { recursive: true });
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
  return [...output].reverse().find((line) => line.trim() && !line.startsWith('[stderr]')) ?? '';
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}
