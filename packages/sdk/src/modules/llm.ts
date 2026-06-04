import type { HttpClient } from '../client';
import type { LLMModel, LLMProvider } from '@agent-spaces/shared';

export function createLlmApi(http: HttpClient) {
  return {
    listModels: (): Promise<LLMModel[]> =>
      http.get('/api/models'),

    createModel: (data: Partial<LLMModel>): Promise<LLMModel> =>
      http.post('/api/models', data),

    updateModel: (id: string, data: Partial<LLMModel>): Promise<LLMModel> =>
      http.put(`/api/models/${id}`, data),

    deleteModel: (id: string): Promise<void> =>
      http.delete(`/api/models/${id}`),

    listProviders: (): Promise<LLMProvider[]> =>
      http.get('/api/providers'),

    createProvider: (data: Partial<LLMProvider>): Promise<LLMProvider> =>
      http.post('/api/providers', data),

    updateProvider: (id: string, data: Partial<LLMProvider>): Promise<LLMProvider> =>
      http.put(`/api/providers/${id}`, data),

    deleteProvider: (id: string): Promise<void> =>
      http.delete(`/api/providers/${id}`),
  };
}
