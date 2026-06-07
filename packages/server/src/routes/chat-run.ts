import { Router, type Response } from 'express';
import type { BuiltInAgentToolName } from '@agent-spaces/shared';
import * as chatService from '../services/chat.js';
import * as agentService from '../services/agent.js';
import { LangChainRuntime } from '../adapters/langchain-runtime.js';
import type { AgentRuntimeConfig, AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';
import {
  createCommandFunctionTools,
  createDatabaseFunctionTools,
  createKanbanFunctionTools,
  createWorkflowExecutionFunctionTools,
} from '../services/builtin-tools/index.js';

const router = Router();

// --- Session-based run ---
router.post('/sessions/:sessionId/run', async (req, res) => {
  const { sessionId } = req.params;
  const { content, regenerateFromMessageId, workspaceId } = req.body as {
    content?: string;
    regenerateFromMessageId?: string;
    workspaceId?: string;
  };

  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }

  const session = chatService.findSession(workspaceId, sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const agentId = session.agentId;
  const regenerateContext = regenerateFromMessageId
    ? resolveSessionRegenerateContext(workspaceId, sessionId, regenerateFromMessageId)
    : null;
  const trimmedContent = (regenerateContext?.content ?? content)?.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const baseURL = resolveChatAgentBaseURL(agent);

  prepareSse(res);

  if (!baseURL && requiresBaseURL(agent.provider)) {
    writeSse(res, 'error', {
      error: `${agent.provider} requires an API Base URL. Edit this chat agent and save the provider API address again.`,
    });
    res.end();
    return;
  }

  if (!regenerateContext) {
    const userMsg = chatService.saveSessionMessage(workspaceId, sessionId, {
      agentId,
      role: 'user',
      content: trimmedContent,
    });
    writeSse(res, 'message_saved', userMsg);
  }

  const config: AgentRuntimeConfig = {
    kind: 'langchain',
    provider: agent.provider,
    model: agent.model,
    apiKey: agent.apiKey,
    baseURL,
  };

  const runtime = new LangChainRuntime(config);
  let completed = false;

  res.on('close', () => {
    if (!completed && !res.writableEnded) runtime.stop();
  });

  try {
    const historyMessages = regenerateContext?.historyMessages
      ?? chatService.getRecentSessionMessages(workspaceId, sessionId, 20).slice(0, -1);
    const historyPrompt = historyMessages
      .filter(shouldIncludeHistoryMessage)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
      .join('\n\n');
    const prompt = historyPrompt
      ? `${historyPrompt}\n\nUser: ${trimmedContent}\nAssistant:`
      : trimmedContent;

    const workingDir = chatService.getAgentWorkingDir(agentId) || process.cwd();
    const configDir = chatService.getAgentConfigDir(agentId) || undefined;
    const tools = normalizeToolNames(agent.tools);
    const functionTools = [
      ...createCommandFunctionTools(agentId, tools),
      ...createDatabaseFunctionTools(agentId, tools),
      ...createKanbanFunctionTools(agentId, tools),
      ...createWorkflowExecutionFunctionTools(tools),
    ];
    const result = await runtime.execute(prompt, workingDir, {
      maxTurns: 100,
      functionTools,
      mcpServers: agentService.getMcpServers(agent.mcps as Parameters<typeof agentService.getMcpServers>[0]),
      skills: normalizeSkillNames(agent.skills),
      configDir,
      systemPrompt: agent.systemPrompt,
      outputStyle: agent.outputStyle,
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
    const agentMsg = chatService.saveSessionMessage(workspaceId, sessionId, {
      agentId,
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

function resolveSessionRegenerateContext(
  workspaceId: string,
  sessionId: string,
  messageId: string,
): { content: string; historyMessages: Array<{ role: 'user' | 'agent'; content: string }> } | null {
  const messages = chatService.listSessionMessages(workspaceId, sessionId);
  const targetIndex = messages.findIndex((message) => message.id === messageId && message.role === 'agent');
  if (targetIndex === -1) return null;

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return {
        content: message.content,
        historyMessages: messages.slice(0, index),
      };
    }
  }

  return null;
}

router.post('/agents/:id/run', async (req, res) => {
  const { id } = req.params;
  const { content, regenerateFromMessageId } = req.body as { content?: string; regenerateFromMessageId?: string };
  const regenerateContext = regenerateFromMessageId
    ? resolveRegenerateContext(id, regenerateFromMessageId)
    : null;
  const trimmedContent = (regenerateContext?.content ?? content)?.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const baseURL = resolveChatAgentBaseURL(agent);

  prepareSse(res);

  if (!baseURL && requiresBaseURL(agent.provider)) {
    writeSse(res, 'error', {
      error: `${agent.provider} requires an API Base URL. Edit this chat agent and save the provider API address again.`,
    });
    res.end();
    return;
  }

  if (!regenerateContext) {
    const userMsg = chatService.saveMessage({
      agentId: id,
      role: 'user',
      content: trimmedContent,
    });
    writeSse(res, 'message_saved', userMsg);
  }

  const config: AgentRuntimeConfig = {
    kind: 'langchain',
    provider: agent.provider,
    model: agent.model,
    apiKey: agent.apiKey,
    baseURL,
  };

  const runtime = new LangChainRuntime(config);
  let completed = false;

  res.on('close', () => {
    if (!completed && !res.writableEnded) runtime.stop();
  });

  try {
    const historyMessages = regenerateContext?.historyMessages ?? chatService.getRecentMessages(id, 20).slice(0, -1);
    const historyPrompt = historyMessages
      .filter(shouldIncludeHistoryMessage)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
      .join('\n\n');
    const prompt = historyPrompt
      ? `${historyPrompt}\n\nUser: ${trimmedContent}\nAssistant:`
      : trimmedContent;

    const workingDir = chatService.getAgentWorkingDir(id) || process.cwd();
    const configDir = chatService.getAgentConfigDir(id) || undefined;
    const tools = normalizeToolNames(agent.tools);
    const functionTools = [
      ...createCommandFunctionTools(id, tools),
      ...createDatabaseFunctionTools(id, tools),
      ...createKanbanFunctionTools(id, tools),
      ...createWorkflowExecutionFunctionTools(tools),
    ];
    const result = await runtime.execute(prompt, workingDir, {
      maxTurns: 100,
      functionTools,
      mcpServers: agentService.getMcpServers(agent.mcps as Parameters<typeof agentService.getMcpServers>[0]),
      skills: normalizeSkillNames(agent.skills),
      configDir,
      systemPrompt: agent.systemPrompt,
      outputStyle: agent.outputStyle,
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

function resolveRegenerateContext(
  agentId: string,
  messageId: string,
): { content: string; historyMessages: Array<{ role: 'user' | 'agent'; content: string }> } | null {
  const messages = chatService.listMessages(agentId);
  const targetIndex = messages.findIndex((message) => message.id === messageId && message.role === 'agent');
  if (targetIndex === -1) return null;

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return {
        content: message.content,
        historyMessages: messages.slice(0, index),
      };
    }
  }

  return null;
}

function resolveChatAgentBaseURL(agent: { baseURL?: string; apiBase?: string }): string | undefined {
  return agent.baseURL?.trim() || agent.apiBase?.trim() || undefined;
}

function requiresBaseURL(provider?: string): boolean {
  return provider === 'openai-chat-completions'
    || provider === 'openai-responses'
    || provider === 'anthropic-messages'
    || provider === 'gemini-generate-content';
}

function normalizeSkillNames(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((skill) => typeof skill === 'string'
      ? skill
      : skill && typeof skill === 'object' && 'name' in skill && typeof skill.name === 'string'
        ? skill.name
        : '')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function normalizeToolNames(tools: unknown): BuiltInAgentToolName[] | undefined {
  if (!Array.isArray(tools)) return undefined;
  return tools.filter((tool): tool is BuiltInAgentToolName => typeof tool === 'string');
}

export default router;
