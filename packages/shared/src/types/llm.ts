export interface LLMModel {
  id: string;
  modelId: string;
  name: string;
  provider: string;
  vision: boolean;
  reasoning: boolean;
  embedding: boolean;
}

export interface LLMProvider {
  id: string;
  name: string;
  apiBase: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}
