import type { HttpClient } from '../client';
import type { AgentConfig } from '@agent-spaces/shared';

export function createAgentApi(http: HttpClient) {
  return {
    listPresets: (): Promise<AgentConfig[]> =>
      http.get('/api/agents/presets'),

    getPreset: (id: string): Promise<AgentConfig> =>
      http.get(`/api/agents/presets/${id}`),

    createPreset: (data: Partial<AgentConfig>): Promise<AgentConfig> =>
      http.post('/api/agents/presets', data),

    updatePreset: (id: string, data: Partial<AgentConfig>): Promise<AgentConfig> =>
      http.put(`/api/agents/presets/${id}`, data),

    deletePreset: (id: string): Promise<void> =>
      http.delete(`/api/agents/presets/${id}`),

    /** 用量仪表盘 */
    usageDashboard: (days = 30): Promise<import('@agent-spaces/shared').AgentUsageDashboard> =>
      http.get(`/api/agents/usage/dashboard?days=${days}`),

    /** Agent Designer — AI 生成 Agent 配置 */
    design: (prompt: string): Promise<Partial<AgentConfig>> =>
      http.post('/api/agents/design', { prompt }),
  };
}
