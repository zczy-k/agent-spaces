import { Router, type Response } from 'express';
import * as chatService from '../services/chat.js';
import { LangChainRuntime } from '../adapters/langchain-runtime.js';
import type { AgentRuntimeConfig, AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';

const router = Router();

router.post('/agents/:id/run', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body as { content?: string };
  const trimmedContent = content?.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  prepareSse(res);

  const userMsg = chatService.saveMessage({
    agentId: id,
    role: 'user',
    content: trimmedContent,
  });
  writeSse(res, 'message_saved', userMsg);

  const config: AgentRuntimeConfig = {
    kind: 'langchain',
    provider: agent.provider,
    model: agent.model,
    apiKey: agent.apiKey,
    baseURL: agent.baseURL,
  };

  const runtime = new LangChainRuntime(config);
  let completed = false;

  res.on('close', () => {
    if (!completed && !res.writableEnded) runtime.stop();
  });

  try {
    const recent = chatService.getRecentMessages(id, 20);
    const historyPrompt = recent
      .slice(0, -1)
      .filter(shouldIncludeHistoryMessage)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
      .join('\n\n');
    const prompt = historyPrompt
      ? `${historyPrompt}\n\nUser: ${trimmedContent}\nAssistant:`
      : trimmedContent;

    const result = await runtime.execute(prompt, process.cwd(), {
      systemPrompt: agent.systemPrompt,
      onEvent: (event: AgentRuntimeEvent) => {
        writeRuntimeEvent(res, event);
      },
    });

    if (!result.success) {
      completed = true;
      writeSse(res, 'error', { error: result.error ?? result.summary });
      return;
    }

    const agentContent = result.output
      .filter((line) => !line.startsWith('Tool:') && !line.startsWith('[Usage]'))
      .join('\n')
      || result.summary;
    const agentMsg = chatService.saveMessage({
      agentId: id,
      role: 'agent',
      content: agentContent,
      usage: result.usage,
    });

    completed = true;
    writeSse(res, 'completed', { message: agentMsg, success: result.success, error: result.error });
  } catch (err) {
    completed = true;
    writeSse(res, 'error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

function prepareSse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.socket?.setNoDelay?.(true);
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  const flushable = res as Response & { flush?: () => void };
  if (typeof flushable.flush === 'function') flushable.flush();
}

function writeRuntimeEvent(res: Response, event: AgentRuntimeEvent): void {
  switch (event.type) {
    case 'output':
      if (!event.line.startsWith('[Usage]')) writeSse(res, 'output', { chunk: event.line });
      break;
    case 'reasoning':
      writeSse(res, 'thinking', { chunk: event.text, status: event.status });
      break;
    case 'tool_use':
      writeSse(res, 'tool_use', { name: event.name, input: event.input });
      break;
    case 'tool_result':
      writeSse(res, 'tool_result', { name: event.toolUseId, result: event.result });
      break;
    case 'session':
    case 'hook_event':
      break;
  }
}

function shouldIncludeHistoryMessage(message: { role: 'user' | 'agent'; content: string }): boolean {
  return !(message.role === 'agent' && message.content.trim() === 'LangChain execution failed');
}

export default router;
