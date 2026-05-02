import { join } from 'node:path';
import type { LLMModel, LLMProvider } from '@agent-spaces/shared';
import { getDataDir, ensureDir, readJsonFile, writeJsonFile } from './json-store.js';
import { v4 as uuid } from 'uuid';

const DEFAULT_MODELS: LLMModel[] = [
  // Anthropic
  { id: 'm-anthropic-opus-47', modelId: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'Anthropic', vision: true, reasoning: true, embedding: false },
  { id: 'm-anthropic-sonnet-46', modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', vision: true, reasoning: false, embedding: false },
  { id: 'm-anthropic-haiku-45', modelId: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', vision: true, reasoning: false, embedding: false },
  // OpenAI
  { id: 'm-openai-gpt4o', modelId: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', vision: true, reasoning: false, embedding: false },
  { id: 'm-openai-gpt4o-mini', modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', vision: true, reasoning: false, embedding: false },
  { id: 'm-openai-o3', modelId: 'o3', name: 'o3', provider: 'OpenAI', vision: false, reasoning: true, embedding: false },
  { id: 'm-openai-o4-mini', modelId: 'o4-mini', name: 'o4-mini', provider: 'OpenAI', vision: false, reasoning: true, embedding: false },
  { id: 'm-openai-embed-large', modelId: 'text-embedding-3-large', name: 'Text Embedding 3 Large', provider: 'OpenAI', vision: false, reasoning: false, embedding: true },
  { id: 'm-openai-embed-small', modelId: 'text-embedding-3-small', name: 'Text Embedding 3 Small', provider: 'OpenAI', vision: false, reasoning: false, embedding: true },
  // Google
  { id: 'm-google-gemini-25-pro', modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', vision: true, reasoning: true, embedding: false },
  { id: 'm-google-gemini-25-flash', modelId: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', vision: true, reasoning: true, embedding: false },
  { id: 'm-google-gemini-20-flash', modelId: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', vision: true, reasoning: false, embedding: false },
  { id: 'm-google-embed', modelId: 'text-embedding-004', name: 'Text Embedding 004', provider: 'Google', vision: false, reasoning: false, embedding: true },
  // DeepSeek
  { id: 'm-deepseek-r1', modelId: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', vision: false, reasoning: true, embedding: false },
  { id: 'm-deepseek-chat', modelId: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek', vision: false, reasoning: false, embedding: false },
  // Meta
  { id: 'm-meta-llama4-mav', modelId: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', vision: true, reasoning: false, embedding: false },
  { id: 'm-meta-llama4-scout', modelId: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'Meta', vision: true, reasoning: false, embedding: false },
  { id: 'm-meta-llama33-70b', modelId: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Meta', vision: false, reasoning: false, embedding: false },
  // Mistral
  { id: 'm-mistral-large', modelId: 'mistral-large', name: 'Mistral Large', provider: 'Mistral', vision: false, reasoning: false, embedding: false },
  { id: 'm-mistral-codestral', modelId: 'codestral', name: 'Codestral', provider: 'Mistral', vision: false, reasoning: false, embedding: false },
  { id: 'm-mistral-embed', modelId: 'mistral-embed', name: 'Mistral Embed', provider: 'Mistral', vision: false, reasoning: false, embedding: true },
];

function llmDir() {
  return join(getDataDir(), 'llm');
}

function modelsFile() {
  return join(llmDir(), 'models.json');
}

function providersFile() {
  return join(llmDir(), 'providers.json');
}

// --- Models ---

export function listModels(): LLMModel[] {
  const models = readJsonFile<LLMModel[]>(modelsFile());
  if (!models) {
    ensureDir(llmDir());
    writeJsonFile(modelsFile(), DEFAULT_MODELS);
    return [...DEFAULT_MODELS];
  }
  return models;
}

export function getModel(id: string): LLMModel | undefined {
  return listModels().find(m => m.id === id);
}

export function createModel(model: Omit<LLMModel, 'id'>): LLMModel {
  const newModel: LLMModel = { ...model, id: uuid() };
  const models = listModels();
  models.push(newModel);
  writeJsonFile(modelsFile(), models);
  return newModel;
}

export function updateModel(id: string, data: Partial<LLMModel>): LLMModel | null {
  const models = listModels();
  const idx = models.findIndex(m => m.id === id);
  if (idx < 0) return null;
  models[idx] = { ...models[idx], ...data, id };
  writeJsonFile(modelsFile(), models);
  return models[idx];
}

export function deleteModel(id: string): boolean {
  const models = listModels();
  const filtered = models.filter(m => m.id !== id);
  if (filtered.length === models.length) return false;
  writeJsonFile(modelsFile(), filtered);
  return true;
}

// --- Providers ---

export function listProviders(): LLMProvider[] {
  return readJsonFile<LLMProvider[]>(providersFile()) || [];
}

export function getProvider(id: string): LLMProvider | undefined {
  return listProviders().find(p => p.id === id);
}

export function createProvider(provider: Omit<LLMProvider, 'id' | 'createdAt' | 'updatedAt'>): LLMProvider {
  const now = new Date().toISOString();
  const newProvider: LLMProvider = { ...provider, id: uuid(), createdAt: now, updatedAt: now };
  const providers = listProviders();
  providers.push(newProvider);
  ensureDir(llmDir());
  writeJsonFile(providersFile(), providers);
  return newProvider;
}

export function updateProvider(id: string, data: Partial<LLMProvider>): LLMProvider | null {
  const providers = listProviders();
  const idx = providers.findIndex(p => p.id === id);
  if (idx < 0) return null;
  providers[idx] = { ...providers[idx], ...data, id, updatedAt: new Date().toISOString() };
  ensureDir(llmDir());
  writeJsonFile(providersFile(), providers);
  return providers[idx];
}

export function deleteProvider(id: string): boolean {
  const providers = listProviders();
  const filtered = providers.filter(p => p.id !== id);
  if (filtered.length === providers.length) return false;
  ensureDir(llmDir());
  writeJsonFile(providersFile(), filtered);
  return true;
}
