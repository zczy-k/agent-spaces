import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLangChainMcpServers,
  resolveLangChainModelSettings,
  stringifyToolResult,
} from '../src/adapters/langchain-runtime.js';

test('resolveLangChainModelSettings uses OpenAI for BigModel compatible Anthropic misconfiguration', () => {
  const settings = resolveLangChainModelSettings({
    provider: 'anthropic-messages',
    model: 'anthropic:GLM-4.7',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  });

  assert.equal(settings.provider, 'openai');
  assert.equal(settings.modelIdentifier, 'openai:GLM-4.7');
  assert.match(settings.providerCorrectionReason ?? '', /OpenAI-compatible/);
});

test('resolveLangChainModelSettings preserves real Anthropic Messages configuration', () => {
  const settings = resolveLangChainModelSettings({
    provider: 'anthropic-messages',
    model: 'claude-sonnet-4-6',
    baseURL: 'https://api.anthropic.com/v1',
  });

  assert.equal(settings.provider, 'anthropic');
  assert.equal(settings.modelIdentifier, 'anthropic:claude-sonnet-4-6');
  assert.equal(settings.providerCorrectionReason, undefined);
});

test('stringifyToolResult serializes structured function tool results for chat content', () => {
  assert.equal(stringifyToolResult('ok'), 'ok');
  assert.equal(stringifyToolResult(undefined), 'null');
  assert.equal(
    stringifyToolResult([{ id: 'db-1', name: 'Knowledge' }]),
    '[\n  {\n    "id": "db-1",\n    "name": "Knowledge"\n  }\n]',
  );
});

test('stringifyToolResult falls back for circular function tool results', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  assert.equal(stringifyToolResult(circular), '[object Object]');
});

test('normalizeLangChainMcpServers maps retired fetch npm package to uvx', () => {
  const normalized = normalizeLangChainMcpServers({
    fetch: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch', '--ignore-robots-txt'],
      env: { CUSTOM_ENV: '1' },
    },
  });

  assert.deepEqual(normalized?.fetch, {
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch', '--ignore-robots-txt'],
    env: { PYTHONIOENCODING: 'utf-8', CUSTOM_ENV: '1' },
  });
});

test('normalizeLangChainMcpServers preserves HTTP MCP config', () => {
  const normalized = normalizeLangChainMcpServers({
    remote: {
      url: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer token' },
    },
  });

  assert.deepEqual(normalized?.remote, {
    transport: 'http',
    url: 'https://example.test/mcp',
    headers: { Authorization: 'Bearer token' },
  });
});
