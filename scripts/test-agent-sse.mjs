#!/usr/bin/env node

const endpoint = process.env.AGENT_SSE_URL || 'http://127.0.0.1:3100/api/agent-sse/run';
const key = process.env.AGENT_SPACES_KEY ?? '';
const agentId = process.env.AGENT_ID || '1f330339-2ecc-4767-9444-80ef8f69a5e0';
const message = process.argv.slice(2).join(' ').trim() || '请用一句话回复：SSE agent 接口测试成功。';

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    key,
    agentid: agentId,
    message,
  }),
});

if (!response.ok || !response.body) {
  const text = await response.text().catch(() => '');
  throw new Error(`Request failed: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`);
}

console.log(`[agent-sse] connected ${endpoint}`);
console.log(`[agent-sse] agentid=${agentId}`);

const decoder = new TextDecoder();
let buffer = '';

for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const events = buffer.split('\n\n');
  buffer = events.pop() ?? '';

  for (const rawEvent of events) {
    const parsed = parseSseEvent(rawEvent);
    if (!parsed) continue;
    printEvent(parsed.event, parsed.data);
    if (parsed.event === 'done' || parsed.event === 'error') process.exit(parsed.event === 'done' ? 0 : 1);
  }
}

function parseSseEvent(raw) {
  const lines = raw.split('\n');
  const event = lines.find((line) => line.startsWith('event: '))?.slice('event: '.length).trim();
  const dataLines = lines
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length));
  if (!event || dataLines.length === 0) return null;
  return {
    event,
    data: JSON.parse(dataLines.join('\n')),
  };
}

function printEvent(event, data) {
  if (event === 'output') {
    console.log(data.line);
    return;
  }
  if (event === 'reasoning') {
    console.log(`[reasoning] ${data.text}`);
    return;
  }
  if (event === 'done') {
    console.log('[done]', JSON.stringify({
      success: data.success,
      summary: data.summary,
      error: data.error,
      durationMs: data.durationMs,
      output: data.output,
    }, null, 2));
    return;
  }
  console.log(`[${event}]`, JSON.stringify(data, null, 2));
}
