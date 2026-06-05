"use client";
import { create } from 'zustand';
import { sdk } from '@/lib/sdk';
import type { ChatAgent, ChatMessage } from '@agent-spaces/sdk';

interface ChatStore {
  agents: ChatAgent[];
  activeAgentId: string | null;
  messages: Record<string, ChatMessage[]>;
  sending: Record<string, boolean>;

  loadAgents: () => Promise<void>;
  createAgent: (data: Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAgent: (id: string, data: Partial<ChatAgent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string) => void;
  loadMessages: (agentId: string) => Promise<void>;
  sendMessage: (agentId: string, content: string) => void;
  stopAgent: (agentId: string) => void;

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
    set((s) => {
      const { [id]: _removed, ...restMessages } = s.messages;
      const { [id]: _sending, ...restSending } = s.sending;
      return {
        agents: s.agents.filter((a) => a.id !== id),
        messages: restMessages,
        sending: restSending,
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

  sendMessage: (agentId, _content) => {
    set((s) => ({ sending: { ...s.sending, [agentId]: true } }));
  },

  stopAgent: (agentId) => {
    set((s) => ({ sending: { ...s.sending, [agentId]: false } }));
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
    }));
  },

  onAgentError: (agentId, _error) => {
    set((s) => ({ sending: { ...s.sending, [agentId]: false } }));
  },
}));
