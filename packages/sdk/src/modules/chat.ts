export interface ChatAgent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  systemPrompt?: string;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  thinking?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export function createChatApi(http: { get: Function; post: Function; put: Function; delete: Function }) {
  return {
    listAgents: (): Promise<ChatAgent[]> =>
      http.get('/api/chat/agents'),

    createAgent: (data: Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChatAgent> =>
      http.post('/api/chat/agents', data),

    updateAgent: (id: string, data: Partial<ChatAgent>): Promise<ChatAgent> =>
      http.put(`/api/chat/agents/${id}`, data),

    deleteAgent: (id: string): Promise<void> =>
      http.delete(`/api/chat/agents/${id}`),

    listMessages: (agentId: string, limit?: number, before?: string): Promise<ChatMessage[]> => {
      const params: string[] = [];
      if (limit) params.push(`limit=${limit}`);
      if (before) params.push(`before=${before}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      return http.get(`/api/chat/agents/${agentId}/messages${qs}`);
    },

    clearMessages: (agentId: string): Promise<void> =>
      http.delete(`/api/chat/agents/${agentId}/messages`),
  };
}
