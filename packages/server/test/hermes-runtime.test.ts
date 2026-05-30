import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { HermesRuntime } from '../src/adapters/hermes-runtime.js';

test('HermesRuntime maps runtime config and options to Hermes CLI args, env, and isolated home', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const captureFile = join(root, 'capture.json');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeHermes(binDir, [
      'const { writeFileSync } = require("node:fs");',
      'const capture = {',
      '  argv: process.argv.slice(2),',
      '  cwd: process.cwd(),',
      '  env: {',
      '    HERMES_HOME: process.env.HERMES_HOME,',
      '    AGENT_SPACES_HERMES_API_KEY: process.env.AGENT_SPACES_HERMES_API_KEY,',
      '    HERMES_API_KEY: process.env.HERMES_API_KEY,',
      '    HERMES_BASE_URL: process.env.HERMES_BASE_URL,',
      '    OPENAI_API_KEY: process.env.OPENAI_API_KEY,',
      '    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,',
      '    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,',
      '    NO_COLOR: process.env.NO_COLOR,',
      '  },',
      '};',
      `writeFileSync(${JSON.stringify(captureFile)}, JSON.stringify(capture, null, 2), "utf-8");`,
      'console.log("ok");',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    mkdirSync(join(configDir, 'skills'), { recursive: true });
    writeFileSync(join(configDir, 'skills', 'plans.md'), 'Plan skill body.', 'utf-8');

    const runtime = new HermesRuntime({
      provider: 'anthropic-messages',
      model: 'GLM-4.7',
      apiKey: 'secret-key',
      baseURL: 'https://example.test/v1',
    });
    const result = await runtime.execute('hello', root, {
      configDir,
      skills: ['plans.md'],
    });

    const capture = JSON.parse(readFileSync(captureFile, 'utf-8')) as {
      argv: string[];
      cwd: string;
      env: Record<string, string>;
    };

    assert.equal(result.success, true);
    assert.equal(capture.cwd, root);
    assert.deepEqual(capture.argv, [
      'chat',
      '-q',
      'hello',
      '--verbose',
      '-s',
      'plans',
      '--model',
      'GLM-4.7',
    ]);
    assert.equal(capture.env.HERMES_HOME, join(configDir, '.hermes'));
    assert.equal(capture.env.AGENT_SPACES_HERMES_API_KEY, 'secret-key');
    assert.equal(capture.env.HERMES_API_KEY, 'secret-key');
    assert.equal(capture.env.HERMES_BASE_URL, 'https://example.test/v1');
    assert.equal(capture.env.OPENAI_API_KEY, 'secret-key');
    assert.equal(capture.env.OPENAI_BASE_URL, 'https://example.test/v1');
    assert.equal(capture.env.ANTHROPIC_API_KEY, 'secret-key');
    assert.equal(capture.env.NO_COLOR, '1');
    assert.equal(existsSync(join(configDir, '.hermes', 'skills', 'plans.md')), true);
    assert.equal(
      readFileSync(join(configDir, '.hermes', 'config.yaml'), 'utf-8'),
      [
        '# Managed by Agent Spaces for this agent profile.',
        'model:',
        '  default: "GLM-4.7"',
        '  provider: custom',
        '  base_url: "https://example.test/v1"',
        '  api_key: ${AGENT_SPACES_HERMES_API_KEY}',
        '  api_mode: anthropic_messages',
        '',
      ].join('\n'),
    );
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('HermesRuntime preserves existing Hermes config.yaml', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const previousPath = currentPathEnv();
  const existingConfig = 'model:\n  provider: openrouter\n';

  try {
    mkdirSync(binDir, { recursive: true });
    mkdirSync(join(configDir, '.hermes'), { recursive: true });
    writeFileSync(join(configDir, '.hermes', 'config.yaml'), existingConfig, 'utf-8');
    writeFakeHermes(binDir, 'console.log("ok");');
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new HermesRuntime({
      provider: 'anthropic-messages',
      model: 'GLM-4.7',
      apiKey: 'secret-key',
      baseURL: 'https://example.test/v1',
    });
    const result = await runtime.execute('hello', root, { configDir });

    assert.equal(result.success, true);
    assert.equal(readFileSync(join(configDir, '.hermes', 'config.yaml'), 'utf-8'), existingConfig);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('HermesRuntime refreshes Agent Spaces managed Hermes config.yaml', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    mkdirSync(join(configDir, '.hermes'), { recursive: true });
    writeFileSync(
      join(configDir, '.hermes', 'config.yaml'),
      '# Managed by Agent Spaces for this agent profile.\nmodel:\n  default: old-model\n',
      'utf-8',
    );
    writeFakeHermes(binDir, 'console.log("ok");');
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new HermesRuntime({
      provider: 'openai-chat-completions',
      model: 'new-model',
      apiKey: 'secret-key',
      baseURL: 'https://example.test/v1',
    });
    const result = await runtime.execute('hello', root, { configDir });

    assert.equal(result.success, true);
    assert.equal(
      readFileSync(join(configDir, '.hermes', 'config.yaml'), 'utf-8'),
      [
        '# Managed by Agent Spaces for this agent profile.',
        'model:',
        '  default: "new-model"',
        '  provider: custom',
        '  base_url: "https://example.test/v1"',
        '  api_key: ${AGENT_SPACES_HERMES_API_KEY}',
        '  api_mode: chat_completions',
        '',
      ].join('\n'),
    );
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('HermesRuntime passes Hermes-native providers through to the Hermes CLI', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-runtime-'));
  const binDir = join(root, 'bin');
  const captureFile = join(root, 'capture.json');
  const previousPath = currentPathEnv();

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeHermes(binDir, [
      'const { writeFileSync } = require("node:fs");',
      `writeFileSync(${JSON.stringify(captureFile)}, JSON.stringify({ argv: process.argv.slice(2) }), "utf-8");`,
      'console.log("ok");',
    ].join('\n'));
    setPathEnv(prependPath(binDir, previousPath));

    const runtime = new HermesRuntime({
      provider: 'openrouter',
      model: 'openai/gpt-4o',
    });
    const result = await runtime.execute('hello', root);

    const capture = JSON.parse(readFileSync(captureFile, 'utf-8')) as {
      argv: string[];
    };

    assert.equal(result.success, true);
    assert.deepEqual(capture.argv, [
      'chat',
      '-q',
      'hello',
      '--verbose',
      '--model',
      'openai/gpt-4o',
      '--provider',
      'openrouter',
    ]);
  } finally {
    restorePathEnv(previousPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('HermesRuntime returns a clear error when the Hermes CLI is missing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-runtime-'));
  const previousPath = currentPathEnv();
  const previousLocalAppData = process.env.LOCALAPPDATA;
  const previousUserProfile = process.env.USERPROFILE;
  const previousHermesCliPath = process.env.HERMES_CLI_PATH;

  try {
    setPathEnv(root);
    delete process.env.HERMES_CLI_PATH;
    process.env.LOCALAPPDATA = join(root, 'missing-local-app-data');
    process.env.USERPROFILE = join(root, 'missing-user-profile');

    const runtime = new HermesRuntime();
    const result = await runtime.execute('hello', root);

    assert.equal(result.success, false);
    assert.equal(
      result.error,
      'Hermes CLI was not found. Install Hermes and ensure the `hermes` command is available on PATH.',
    );
  } finally {
    restorePathEnv(previousPath);
    restoreEnvValue('LOCALAPPDATA', previousLocalAppData);
    restoreEnvValue('USERPROFILE', previousUserProfile);
    restoreEnvValue('HERMES_CLI_PATH', previousHermesCliPath);
    rmSync(root, { recursive: true, force: true });
  }
});

test('HermesRuntime falls back to the Windows local Hermes install when PATH is stale', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-specific executable lookup');
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'hermes-runtime-'));
  const localAppData = join(root, 'local-app-data');
  const binDir = join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts');
  const previousPath = currentPathEnv();
  const previousLocalAppData = process.env.LOCALAPPDATA;
  const previousHermesCliPath = process.env.HERMES_CLI_PATH;

  try {
    mkdirSync(binDir, { recursive: true });
    writeFakeHermes(binDir, 'console.log("ok from local app data");');
    setPathEnv(root);
    delete process.env.HERMES_CLI_PATH;
    process.env.LOCALAPPDATA = localAppData;

    const runtime = new HermesRuntime();
    const result = await runtime.execute('hello', root);

    assert.equal(result.success, true);
    assert.deepEqual(result.output, ['ok from local app data']);
  } finally {
    restorePathEnv(previousPath);
    restoreEnvValue('LOCALAPPDATA', previousLocalAppData);
    restoreEnvValue('HERMES_CLI_PATH', previousHermesCliPath);
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
  restoreEnvValue(pathEnvKey(), value);
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function writeFakeHermes(binDir: string, source: string): void {
  const scriptPath = join(binDir, 'fake-hermes.cjs');
  writeFileSync(scriptPath, source, 'utf-8');

  if (process.platform === 'win32') {
    writeWindowsExeShim(binDir, scriptPath);
    return;
  }

  const executablePath = join(binDir, 'hermes');
  writeFileSync(
    executablePath,
    '#!/bin/sh\nSCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec node "$SCRIPT_DIR/fake-hermes.cjs" "$@"\n',
    'utf-8',
  );
  chmodSync(executablePath, 0o755);
}

function writeWindowsExeShim(binDir: string, scriptPath: string): void {
  const sourcePath = join(binDir, 'hermes-shim.c');
  const executablePath = join(binDir, 'hermes.exe');
  const cSource = [
    '#include <windows.h>',
    '#include <stdio.h>',
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
    throw new Error(`Failed to build fake hermes.exe: ${result.stderr || result.stdout}`);
  }
}
