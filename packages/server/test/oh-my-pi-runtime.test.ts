import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import { OhMyPiRuntime } from '../src/adapters/oh-my-pi-runtime.js';

test('OhMyPiRuntime copies configured skills into the isolated OMP agent dir', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, 'console.log("ok");');
    setPathEnv(prependPath(binDir, previousPath));

    mkdirSync(join(configDir, 'skills', 'brainstorming'), { recursive: true });
    writeFileSync(join(configDir, 'skills', 'brainstorming', 'SKILL.md'), 'Brainstorm skill body.', 'utf-8');
    writeFileSync(join(configDir, 'skills', 'legacy.md'), 'Legacy skill body.', 'utf-8');

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      configDir,
      skills: ['brainstorming', 'legacy'],
    });

    assert.equal(result.success, true);
    assert.equal(
      readFileSync(join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'brainstorming', 'SKILL.md'), 'utf-8'),
      'Brainstorm skill body.',
    );
    assert.equal(
      readFileSync(join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'legacy', 'SKILL.md'), 'utf-8'),
      'Legacy skill body.',
    );
    assert.equal(existsSync(join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'legacy.md')), true);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime falls back from empty agent skill placeholders to built-in skill store', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const envFile = join(root, 'env.txt');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, [
      'const { writeFileSync } = require("node:fs");',
      `writeFileSync(${JSON.stringify(envFile)}, process.env.PI_CODING_AGENT_DIR ?? "", "utf-8");`,
      'console.log("ok");',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    mkdirSync(join(configDir, 'skills'), { recursive: true });
    writeFileSync(join(configDir, 'skills', 'brainstorming.md'), '', 'utf-8');

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      configDir,
      skills: ['brainstorming'],
    });

    const copied = readFileSync(
      join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'brainstorming', 'SKILL.md'),
      'utf-8',
    );

    assert.equal(result.success, true);
    assert.match(copied, /name: brainstorming/);
    assert.match(copied, /# Brainstorming Ideas Into Designs/);
    assert.equal(readFileSync(envFile, 'utf-8').trim(), join(configDir, 'omp-home', '.omp', 'agent'));
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime maps runtime config and options to OMP CLI args, env, and config files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const captureFile = join(root, 'capture.json');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, [
      'const { writeFileSync } = require("node:fs");',
      'const capture = {',
      '  argv: process.argv.slice(2),',
      '  cwd: process.cwd(),',
      '  env: {',
      '    HOME: process.env.HOME,',
      '    USERPROFILE: process.env.USERPROFILE,',
      '    HOMEDRIVE: process.env.HOMEDRIVE,',
      '    HOMEPATH: process.env.HOMEPATH,',
      '    OMP_LOG_DIR: process.env.OMP_LOG_DIR,',
      '    AGENT_SPACES_OMP_API_KEY: process.env.AGENT_SPACES_OMP_API_KEY,',
      '    PI_API_KEY: process.env.PI_API_KEY,',
      '    OMP_API_KEY: process.env.OMP_API_KEY,',
      '    OPENAI_API_KEY: process.env.OPENAI_API_KEY,',
      '    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,',
      '    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,',
      '    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,',
      '    PI_AGENT_DIR: process.env.PI_AGENT_DIR,',
      '    OMP_AGENT_DIR: process.env.OMP_AGENT_DIR,',
      '    PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,',
      '    NO_COLOR: process.env.NO_COLOR,',
      '  },',
      '};',
      `writeFileSync(${JSON.stringify(captureFile)}, JSON.stringify(capture, null, 2), "utf-8");`,
      'console.log("ok");',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime({
      provider: 'openai-chat-completions',
      model: 'gpt-test',
      apiKey: 'secret-key',
      baseURL: 'https://example.test/v1',
      thinkingEffort: 'high',
    });
    const result = await runtime.execute('hello', root, {
      configDir,
      resumeSessionId: 'session-123',
      tools: ['Read', 'Write'],
      systemPrompt: 'Use concise answers.',
      skills: ['brainstorming', 'legacy'],
    });

    const capture = JSON.parse(readFileSync(captureFile, 'utf-8')) as {
      argv: string[];
      cwd: string;
      env: Record<string, string>;
    };
    const agentDir = join(configDir, 'omp-home', '.omp', 'agent');

    assert.equal(result.success, true);
    assert.equal(capture.cwd, root);
    assert.deepEqual(capture.argv, [
      '--mode', 'json',
      '--resume', 'session-123',
      '--model', 'gpt-test',
      '--provider', 'openai-chat-completions',
      '--api-key', 'secret-key',
      '--thinking', 'high',
      '--tools', 'Read,Write',
      '--system-prompt', 'Use concise answers.',
      '--skills', 'brainstorming,legacy',
      '--session-dir', join(agentDir, 'sessions'),
      '-p', 'hello',
    ]);
    assert.equal(capture.env.HOME, join(configDir, 'omp-home'));
    assert.equal(capture.env.USERPROFILE, join(configDir, 'omp-home'));
    assert.equal(capture.env.HOMEDRIVE, undefined);
    assert.equal(capture.env.HOMEPATH, undefined);
    assert.equal(capture.env.OMP_LOG_DIR, join(agentDir, 'logs'));
    assert.equal(capture.env.AGENT_SPACES_OMP_API_KEY, 'secret-key');
    assert.equal(capture.env.PI_API_KEY, 'secret-key');
    assert.equal(capture.env.OMP_API_KEY, 'secret-key');
    assert.equal(capture.env.OPENAI_API_KEY, 'secret-key');
    assert.equal(capture.env.OPENAI_BASE_URL, 'https://example.test/v1');
    assert.equal(capture.env.ANTHROPIC_BASE_URL, 'https://example.test/v1');
    assert.equal(capture.env.PI_AGENT_DIR, agentDir);
    assert.equal(capture.env.OMP_AGENT_DIR, agentDir);
    assert.equal(capture.env.PI_CODING_AGENT_DIR, agentDir);
    assert.equal(capture.env.NO_COLOR, '1');

    const configYaml = readFileSync(join(agentDir, 'config.yml'), 'utf-8');
    const modelsYaml = readFileSync(join(agentDir, 'models.yml'), 'utf-8');
    assert.match(configYaml, /modelRoles:\n  default: "openai-chat-completions\/gpt-test"/);
    assert.match(configYaml, /defaultThinkingLevel: "high"/);
    assert.match(modelsYaml, /baseUrl: "https:\/\/example\.test\/v1"/);
    assert.match(modelsYaml, /apiKey: "AGENT_SPACES_OMP_API_KEY"/);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime maps stdout, stderr, buffered lines, session events, and failed exit codes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const previousPath = currentPathEnv();
  const events: Array<{ type: string; line?: string; sessionId?: string }> = [];

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, [
      'process.stdout.write("first line\\n");',
      'process.stdout.write("session id: omp-session-42\\n");',
      'process.stdout.write("\\u001b[31mbuffered stdout\\u001b[0m");',
      'process.stderr.write("stderr line\\n");',
      'process.stderr.write("buffered stderr");',
      'process.exitCode = 7;',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.success, false);
    assert.equal(result.error, 'Oh My Pi execution failed with exit code 7');
    assert.equal(result.sessionId, 'omp-session-42');
    assert.deepEqual(new Set(result.output), new Set([
      'first line',
      'session id: omp-session-42',
      '[stderr] stderr line',
      'buffered stdout',
      '[stderr] buffered stderr',
    ]));
    assert.ok(result.output.indexOf('first line') < result.output.indexOf('buffered stdout'));
    assert.ok(result.output.indexOf('[stderr] stderr line') < result.output.indexOf('[stderr] buffered stderr'));
    assert.deepEqual(events.filter((event) => event.type === 'session'), [
      { type: 'session', sessionId: 'omp-session-42' },
    ]);
    assert.deepEqual(
      new Set(events.filter((event) => event.type === 'output').map((event) => event.line)),
      new Set(result.output),
    );
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime maps JSON mode events to structured runtime events', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const previousPath = currentPathEnv();
  const events: Array<{ type: string; line?: string; sessionId?: string; id?: string; name?: string; input?: unknown; toolUseId?: string; result?: unknown }> = [];

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, [
      'const events = [',
      '  { type: "session", session_id: "json-session-1" },',
      '  { type: "assistant", content: [{ type: "reasoning", text: "thinking" }, { type: "text", text: "hello json" }] },',
      '  { type: "assistant", content: [{ type: "tool_use", id: "tool-1", name: "Read", input: { file: "README.md" } }] },',
      '  { type: "tool_result", tool_use_id: "tool-1", result: { ok: true } },',
      '  { type: "usage", usage: { input_tokens: 3, output_tokens: 5, reasoning_tokens: 2 }, total_cost_usd: 0.01 },',
      '  { type: "turn_end", message: { content: [{ type: "text", text: "<think>hidden</think>\\nhello json" }] } },',
      '];',
      'for (const event of events) console.log(JSON.stringify(event));',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.success, true);
    assert.equal(result.sessionId, 'json-session-1');
    assert.deepEqual(result.output, ['hello json']);
    assert.deepEqual(result.usage, {
      inputTokens: 3,
      outputTokens: 5,
      totalTokens: undefined,
      cachedInputTokens: undefined,
      reasoningTokens: 2,
    });
    assert.equal(result.costUsd, 0.01);
    assert.deepEqual(events, [
      { type: 'session', sessionId: 'json-session-1' },
      { type: 'reasoning', text: 'thinking', status: 'completed' },
      { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file: 'README.md' }, line: 'Tool: Read {"file":"README.md"}' },
      { type: 'tool_result', toolUseId: 'tool-1', result: { ok: true } },
      { type: 'output', line: 'hello json' },
    ]);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime maps OMP tool execution events to structured runtime events', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const previousPath = currentPathEnv();
  const events: Array<{ type: string; line?: string; id?: string; name?: string; input?: unknown; toolUseId?: string; result?: unknown }> = [];

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, [
      'const events = [',
      '  { type: "message_update", message: { content: [{ type: "text", text: "thinking" }, { type: "toolCall", id: "call-1", name: "fetch", args: {} }] } },',
      '  { type: "message_update", message: { content: [{ type: "text", text: "thinking" }, { type: "toolCall", id: "call-1", name: "fetch", args: {} }] } },',
      '  { type: "tool_execution_start", toolCallId: "call-1", toolName: "fetch", args: { url: "https://example.test/data.json" }, intent: "read url" },',
      '  { type: "tool_execution_end", toolCallId: "call-1", toolName: "fetch", result: "ok", isError: false },',
      '  { type: "turn_end", message: { content: [{ type: "text", text: "<think>hidden</think>\\nfinal answer" }] } },',
      '];',
      'for (const event of events) console.log(JSON.stringify(event));',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.success, true);
    assert.deepEqual(events.filter((event) => event.type === 'tool_use'), [
      {
        type: 'tool_use',
        id: 'call-1',
        name: 'fetch',
        input: { url: 'https://example.test/data.json' },
        line: 'Tool: fetch {"url":"https://example.test/data.json"}',
      },
    ]);
    assert.deepEqual(events.filter((event) => event.type === 'tool_result'), [
      { type: 'tool_result', toolUseId: 'call-1', result: 'ok' },
    ]);
    assert.deepEqual(result.output, ['final answer']);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime ignores OMP intermediate message output and keeps only final visible turn output', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const previousPath = currentPathEnv();
  const events: Array<{ type: string; line?: string; toolUseId?: string; result?: unknown }> = [];

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, [
      'const events = [',
      '  { type: "tool_execution_start", toolCallId: "call-1", toolName: "fetchWebContent", args: { url: "https://example.test" } },',
      '  { type: "tool_execution_end", toolCallId: "call-1", toolName: "fetchWebContent", result: { content: [{ type: "text", text: "Error: read ECONNRESET" }] }, isError: true },',
      '  { type: "message_start", message: { content: [{ type: "text", text: "Error: read ECONNRESET" }] } },',
      '  { type: "message_end", message: { content: [{ type: "text", text: "Error: read ECONNRESET" }] } },',
      '  { type: "turn_end", message: { content: [{ type: "text", text: "<think>internal</think>\\n已尝试获取内容，但远程连接被重置。" }] } },',
      '];',
      'for (const event of events) console.log(JSON.stringify(event));',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.output, ['已尝试获取内容，但远程连接被重置。']);
    assert.deepEqual(events.filter((event) => event.type === 'output').map((event) => event.line), [
      '已尝试获取内容，但远程连接被重置。',
    ]);
    assert.equal(events.filter((event) => event.type === 'tool_result').length, 1);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime writes configured MCP servers and function tool bridge into mcp.json', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, 'console.log("ok");');
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      configDir,
      mcpServers: {
        github: { command: 'github-mcp' },
      },
      functionTools: [
        {
          name: 'current_issue',
          description: 'Return current issue.',
          inputSchema: { type: 'object', properties: {} },
          execute: async () => ({ id: 'ISSUE-1' }),
        },
      ],
    });

    const mcpConfig = JSON.parse(
      readFileSync(join(configDir, 'omp-home', '.omp', 'agent', 'mcp.json'), 'utf-8'),
    ) as { mcpServers: Record<string, { command?: string; url?: string; type?: string }> };

    assert.equal(result.success, true);
    assert.deepEqual(mcpConfig.mcpServers.github, { command: 'github-mcp' });
    assert.equal(mcpConfig.mcpServers['agent-spaces'].type, 'http');
    assert.match(mcpConfig.mcpServers['agent-spaces'].url ?? '', /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime.stop terminates the active OMP process', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, FAKE_OMP_SLEEP_FOREVER);
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new OhMyPiRuntime();
    const run = runtime.execute('hello', root);

    await new Promise((resolve) => setTimeout(resolve, 100));
    runtime.stop();

    const result = await run;
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /Oh My Pi execution stopped by signal|exit code/);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime returns a clear error when the OMP CLI is missing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const previousPath = currentPathEnv();
  const previousLocalAppData = process.env.LOCALAPPDATA;
  const previousUserProfile = process.env.USERPROFILE;

  try {
    setPathEnv(root);
    process.env.LOCALAPPDATA = join(root, 'missing-local-app-data');
    process.env.USERPROFILE = join(root, 'missing-user-profile');

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root);

    assert.equal(result.success, false);
    assert.equal(
      result.error,
      'Oh My Pi CLI was not found. Install OMP and ensure the `omp` command is available on PATH.',
    );
  } finally {
    restorePathEnv(previousPath);
    if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previousLocalAppData;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime falls back to the Windows local OMP install when PATH is stale', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-specific executable lookup');
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const localAppData = join(root, 'local-app-data');
  const binDir = join(localAppData, 'omp');
  const previousPath = currentPathEnv();
  const previousLocalAppData = process.env.LOCALAPPDATA;

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeOmp(binDir, 'console.log("ok from local app data");');
    setPathEnv(root);
    process.env.LOCALAPPDATA = localAppData;

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root);

    assert.equal(result.success, true);
    assert.deepEqual(result.output, ['ok from local app data']);
  } finally {
    restorePathEnv(previousPath);
    if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previousLocalAppData;
    rmSync(root, { recursive: true, force: true });
  }
});

function prependPath(binDir: string, previousPath: string | undefined): string {
  return previousPath ? `${binDir}${delimiter}${previousPath}` : binDir;
}

function pathEnvKey(): string {
  return Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
}

function currentPathEnv(): string | undefined {
  return process.env[pathEnvKey()];
}

function setPathEnv(value: string): void {
  process.env[pathEnvKey()] = value;
}

function restorePathEnv(value: string | undefined): void {
  const key = pathEnvKey();
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function writeFakeOmp(binDir: string, source: string): void {
  if (process.platform === 'win32' && source === FAKE_OMP_SLEEP_FOREVER) {
    writeWindowsSleepExe(binDir);
    return;
  }

  const scriptPath = join(binDir, 'fake-omp.cjs');
  writeFileSync(scriptPath, source, 'utf-8');

  if (process.platform === 'win32') {
    writeWindowsExeShim(binDir, scriptPath);
    return;
  }

  const executablePath = join(binDir, 'omp');
  writeFileSync(
    executablePath,
    '#!/bin/sh\nSCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec node "$SCRIPT_DIR/fake-omp.cjs" "$@"\n',
    'utf-8',
  );
  chmodSync(executablePath, 0o755);
}

const FAKE_OMP_SLEEP_FOREVER = '__FAKE_OMP_SLEEP_FOREVER__';

function writeWindowsExeShim(binDir: string, scriptPath: string): void {
  const sourcePath = join(binDir, 'omp-shim.c');
  const executablePath = join(binDir, 'omp.exe');
  const cSource = [
    '#include <windows.h>',
    '#include <stdio.h>',
    '#include <stdlib.h>',
    '#include <string.h>',
    '',
    'static void append(char *buffer, size_t size, const char *text) {',
    '  strncat(buffer, text, size - strlen(buffer) - 1);',
    '}',
    '',
    'static void append_quoted(char *buffer, size_t size, const char *text) {',
    '  append(buffer, size, "\\"");',
    '  for (const char *p = text; *p; p++) {',
    '    if (*p == \'"\') append(buffer, size, "\\\\\\"");',
    '    else {',
    '      char ch[2] = { *p, 0 };',
    '      append(buffer, size, ch);',
    '    }',
    '  }',
    '  append(buffer, size, "\\"");',
    '}',
    '',
    'int main(int argc, char **argv) {',
    '  char command[32768] = "";',
    `  append_quoted(command, sizeof(command), ${JSON.stringify(process.execPath.replace(/\\/g, '\\\\'))});`,
    '  append(command, sizeof(command), " ");',
    `  append_quoted(command, sizeof(command), ${JSON.stringify(scriptPath.replace(/\\/g, '\\\\'))});`,
    '  for (int i = 1; i < argc; i++) {',
    '    append(command, sizeof(command), " ");',
    '    append_quoted(command, sizeof(command), argv[i]);',
    '  }',
    '',
    '  STARTUPINFOA startup;',
    '  PROCESS_INFORMATION process;',
    '  ZeroMemory(&startup, sizeof(startup));',
    '  ZeroMemory(&process, sizeof(process));',
    '  startup.cb = sizeof(startup);',
    '',
    '  if (!CreateProcessA(NULL, command, NULL, NULL, TRUE, 0, NULL, NULL, &startup, &process)) {',
    '    fprintf(stderr, "CreateProcess failed: %lu\\n", GetLastError());',
    '    return 1;',
    '  }',
    '',
    '  WaitForSingleObject(process.hProcess, INFINITE);',
    '  DWORD exitCode = 1;',
    '  GetExitCodeProcess(process.hProcess, &exitCode);',
    '  CloseHandle(process.hProcess);',
    '  CloseHandle(process.hThread);',
    '  return (int)exitCode;',
    '}',
    '',
  ].join('\n');
  writeFileSync(sourcePath, cSource, 'utf-8');

  const result = spawnSync('gcc', [sourcePath, '-o', executablePath], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`Failed to build fake omp.exe: ${result.stderr || result.stdout}`);
  }
}

function writeWindowsSleepExe(binDir: string): void {
  const sourcePath = join(binDir, 'omp-sleep.c');
  const executablePath = join(binDir, 'omp.exe');
  writeFileSync(sourcePath, [
    '#include <windows.h>',
    'int main(void) {',
    '  Sleep(INFINITE);',
    '  return 0;',
    '}',
    '',
  ].join('\n'), 'utf-8');

  const result = spawnSync('gcc', [sourcePath, '-o', executablePath], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`Failed to build fake sleep omp.exe: ${result.stderr || result.stdout}`);
  }
}
