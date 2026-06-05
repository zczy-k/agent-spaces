"use client";
import { create } from 'zustand';
import type { StoreApi } from 'zustand';
import { sdk } from '@/lib/sdk';
import type { ChatAgent, ChatMessage } from '@agent-spaces/sdk';

const activeChatRequests = new Map<string, AbortController>();
type ChatSet = StoreApi<ChatStore>['setState'];

interface ChatStore {
  agents: ChatAgent[];
  activeAgentId: string | null;
  messages: Record<string, ChatMessage[]>;
  sending: Record<string, boolean>;
  errors: Record<string, string>;
  streamingContent: Record<string, string>;
  streamingThinking: Record<string, string>;

  loadAgents: () => Promise<void>;
  createAgent: (data: Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAgent: (id: string, data: Partial<ChatAgent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string) => void;
  loadMessages: (agentId: string) => Promise<void>;
  sendMessage: (agentId: string, content: string) => void;
  stopAgent: (agentId: string) => void;
  clearMessages: (agentId: string) => void;

  // WS event handlers
  onMessageSaved: (msg: ChatMessage) => void;
  onAgentCompleted: (agentId: string, message: ChatMessage) => void;
  onAgentError: (agentId: string, error: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  agents: [],
  activeAgentId: null,
  messages: {},
  sending: {},
  errors: {},
  streamingContent: {},
  streamingThinking: {},

  loadAgents: async () => {
    try {
      const agents = await sdk.chat.listAgents();
      set({ agents });
    } catch { /* ignore */ }
  },

  createAgent: async (data) => {
    const agent = await sdk.chat.createAgent(data);
    set((s) => ({ agents: [...s.agents, agent] }));
  },

  updateAgent: async (id, data) => {
    const updated = await sdk.chat.updateAgent(id, data);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAgent: async (id) => {
    await sdk.chat.deleteAgent(id);
    activeChatRequests.get(id)?.abort();
    activeChatRequests.delete(id);
    set((s) => {
      const { [id]: _removed, ...restMessages } = s.messages;
      const { [id]: _sending, ...restSending } = s.sending;
      const { [id]: _error, ...restErrors } = s.errors;
      const { [id]: _streamingContent, ...restStreamingContent } = s.streamingContent;
      const { [id]: _streamingThinking, ...restStreamingThinking } = s.streamingThinking;
      return {
        agents: s.agents.filter((a) => a.id !== id),
        messages: restMessages,
        sending: restSending,
        errors: restErrors,
        streamingContent: restStreamingContent,
        streamingThinking: restStreamingThinking,
        activeAgentId: s.activeAgentId === id ? null : s.activeAgentId,
      };
    });
  },

  selectAgent: (id) => {
    set({ activeAgentId: id });
    const { messages } = get();
    if (!messages[id]) {
      get().loadMessages(id);
    }
  },

  loadMessages: async (agentId) => {
    try {
      const msgs = await sdk.chat.listMessages(agentId);
      set((s) => ({ messages: { ...s.messages, [agentId]: msgs } }));
    } catch { /* ignore */ }
  },

  sendMessage: async (agentId, content) => {
    if (get().sending[agentId]) return;

    const controller = new AbortController();
    activeChatRequests.set(agentId, controller);
    set((s) => ({
      sending: { ...s.sending, [agentId]: true },
      errors: { ...s.errors, [agentId]: '' },
      streamingContent: { ...s.streamingContent, [agentId]: '' },
      streamingThinking: { ...s.streamingThinking, [agentId]: '' },
    }));

    try {
      const response = await sdk.http.raw(`/api/chat/agents/${agentId}/run`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok || !response.body) {
        get().onAgentError(agentId, await response.text().catch(() => response.statusText));
        return;
      }

      await readChatRunStream(agentId, response.body, get, set);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        get().onAgentError(agentId, err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (activeChatRequests.get(agentId) === controller) {
        activeChatRequests.delete(agentId);
      }
      set((s) => ({
        sending: { ...s.sending, [agentId]: false },
      }));
    }
  },

  stopAgent: (agentId) => {
    activeChatRequests.get(agentId)?.abort();
    activeChatRequests.delete(agentId);
    set((s) => ({
      sending: { ...s.sending, [agentId]: false },
      errors: { ...s.errors, [agentId]: '' },
      streamingContent: { ...s.streamingContent, [agentId]: '' },
      streamingThinking: { ...s.streamingThinking, [agentId]: '' },
    }));
  },

  clearMessages: async (agentId) => {
    await sdk.chat.clearMessages(agentId);
    set((s) => ({
      messages: { ...s.messages, [agentId]: [] },
    }));
  },

  onMessageSaved: (msg) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [msg.agentId]: [...(s.messages[msg.agentId] ?? []), msg],
      },
    }));
  },

  onAgentCompleted: (agentId, message) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [agentId]: [...(s.messages[agentId] ?? []), message],
      },
      sending: { ...s.sending, [agentId]: false },
      errors: { ...s.errors, [agentId]: '' },
      streamingContent: { ...s.streamingContent, [agentId]: '' },
      streamingThinking: { ...s.streamingThinking, [agentId]: '' },
    }));
  },

  onAgentError: (agentId, error) => {
    set((s) => ({
      sending: { ...s.sending, [agentId]: false },
      errors: { ...s.errors, [agentId]: error },
      streamingContent: { ...s.streamingContent, [agentId]: '' },
      streamingThinking: { ...s.streamingThinking, [agentId]: '' },
    }));
  },
}));

async function readChatRunStream(
  agentId: string,
  body: ReadableStream<Uint8Array>,
  get: () => ChatStore,
  set: ChatSet,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      handleChatRunEvent(agentId, parseSseBlock(block), get, set);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleChatRunEvent(agentId, parseSseBlock(buffer), get, set);
  }
}

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = '';
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!event || dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

function handleChatRunEvent(
  agentId: string,
  payload: { event: string; data: unknown } | null,
  get: () => ChatStore,
  set: ChatSet,
): void {
  if (!payload) return;

  switch (payload.event) {
    case 'message_saved':
      get().onMessageSaved(payload.data as ChatMessage);
      break;
    case 'output': {
      const data = payload.data as { chunk?: string };
      appendStreamingText(set, 'streamingContent', agentId, data.chunk);
      break;
    }
    case 'thinking': {
      const data = payload.data as { chunk?: string };
      appendStreamingText(set, 'streamingThinking', agentId, data.chunk);
      break;
    }
    case 'completed': {
      const data = payload.data as { message?: ChatMessage };
      if (data.message) get().onAgentCompleted(agentId, data.message);
      break;
    }
    case 'error': {
      const data = payload.data as { error?: string };
      get().onAgentError(agentId, data.error ?? 'Chat run failed');
      break;
    }
  }
}

function appendStreamingText(
  set: ChatSet,
  key: 'streamingContent' | 'streamingThinking',
  agentId: string,
  chunk?: string,
): void {
  if (!chunk) return;
  set((s) => ({
    [key]: {
      ...s[key],
      [agentId]: (s[key][agentId] ?? '') + chunk,
    },
  }));
}
