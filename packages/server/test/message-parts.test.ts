import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentMessageParts, normalizeOutputLines } from '../src/ws/message-parts.js';

test('normalizeOutputLines drops Agent Spaces prompt echo blocks', () => {
  const lines = normalizeOutputLines([
    'Agent Spaces channel tools configured for this channel: none',
    'Code directories (boundDirs): C:\\Users\\Administrator\\open-ai-test',
    'For Bash commands that create or modify files under the current working directory, use relative paths such as mkdir -p css js instead of absolute paths.',
    'When asked what MCP servers, skills, runtime tools, or Agent Spaces channel tools you have, answer from this configuration only.',
    'Important distinction: MCP servers configured for this agent are only the names in "MCP servers configured for this agent". Agent Spaces channel tools are built-in runtime tools and must not be listed as agent-configured MCP servers.',
    'Do not infer availability from provider-side function names, hidden runtime internals, previous sessions, or filesystem settings. User message: @test fetch data',
    '结果如下：',
  ]);

  assert.deepEqual(lines, ['结果如下：']);
});

test('buildAgentMessageParts strips tool loop warning prefix from final text', () => {
  const parts = buildAgentMessageParts({
    sessionId: 'session-1',
    presetName: 'test',
    role: 'assistant',
    mcpServers: [],
    skills: [],
    output: [
      '[Tool loop warning: same_tool_failure_warning; count=4; terminal has failed 4 times this turn.] 由于当前 shell 环境不可用，我先改用浏览器工具来读取该 URL 的 JSON 内容。',
    ],
    success: true,
  });

  const textPart = parts.find((part) => part.type === 'text');
  assert.equal(
    textPart?.type === 'text' ? textPart.text : undefined,
    '由于当前 shell 环境不可用，我先改用浏览器工具来读取该 URL 的 JSON 内容。',
  );
});
