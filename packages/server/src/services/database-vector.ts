import { createHash } from 'node:crypto';
import type { DatabaseVectorIndexResult, DatabaseVectorSearchResult, LLMModel, LLMProvider } from '@agent-spaces/shared';
import * as databaseStore from '../storage/database-store.js';
import * as llmStore from '../storage/llm-store.js';

const INDEX_BATCH_SIZE = 16;
const MAX_INDEX_TEXT_LENGTH = 24_000;

export interface DatabaseVectorDebug {
  stage: string;
  providerName?: string;
  modelId?: string;
  requestUrl?: string;
  inputCount?: number;
  inputLengths?: number[];
  status?: number;
  responseContentType?: string | null;
  responseDataCount?: number;
  validEmbeddingCount?: number;
  embeddingDimensions?: number[];
  responseKeys?: string[];
  responsePreview?: unknown;
  batchStart?: number;
  batchSize?: number;
  indexedCount?: number;
}

export class DatabaseVectorError extends Error {
  debug: DatabaseVectorDebug;

  constructor(message: string, debug: DatabaseVectorDebug) {
    super(message);
    this.name = 'DatabaseVectorError';
    this.debug = debug;
  }
}

export async function indexDatabaseVectors(workspaceId: string, databaseId: string): Promise<DatabaseVectorIndexResult> {
  const database = databaseStore.getDatabase(workspaceId, databaseId);
  if (!database) throw new Error(`Database not found: ${databaseId}`);
  if (!database.embeddingModelId) throw new Error('Embedding model is not bound to this database.');

  const config = requireEmbeddingModelConfig(database.embeddingModelId);
  const nodes = databaseStore.listNodes(workspaceId, databaseId).filter((node) => !node.isTrash);
  const records = nodes
    .map((node) => ({
      node,
      path: buildDatabaseNodePath(node, nodes),
      text: normalizeIndexText(`${node.title}\n${stripHtml(node.content)}`),
    }))
    .filter((item) => item.text.length > 0);

  let indexedCount = 0;
  for (let index = 0; index < records.length; index += INDEX_BATCH_SIZE) {
    const batch = records.slice(index, index + INDEX_BATCH_SIZE);
    const batchDebug = {
      batchStart: index,
      batchSize: batch.length,
      indexedCount,
    };
    console.info('[database-vector:index] embedding batch', {
      workspaceId,
      databaseId,
      modelId: config.model.modelId,
      providerName: config.provider.name,
      ...batchDebug,
      inputLengths: batch.map((item) => item.text.length),
    });
    const embeddings = await embedTexts(config, batch.map((item) => item.text), batchDebug);
    embeddings.forEach((embedding, offset) => {
      const item = batch[offset];
      databaseStore.upsertDatabaseEmbedding(workspaceId, databaseId, {
        nodeId: item.node.id,
        title: item.node.title,
        path: item.path,
        content: item.text,
        contentHash: hashText(item.text),
        embedding,
        modelId: config.model.modelId,
        agentId: config.model.id,
      });
      indexedCount++;
    });
  }

  databaseStore.deleteStaleDatabaseEmbeddings(workspaceId, databaseId, records.map((item) => item.node.id));
  return {
    ...databaseStore.getVectorStats(workspaceId, databaseId),
    indexedCount,
    skippedCount: nodes.length - records.length,
  };
}

export async function searchDatabaseVectors(
  workspaceId: string,
  databaseId: string,
  query: string,
  limit = 5,
): Promise<DatabaseVectorSearchResult[]> {
  const database = databaseStore.getDatabase(workspaceId, databaseId);
  if (!database) throw new Error(`Database not found: ${databaseId}`);
  if (!database.embeddingModelId) throw new Error('Embedding model is not bound to this database.');

  const cleanQuery = normalizeIndexText(query);
  if (!cleanQuery) throw new Error('query is required.');

  const config = requireEmbeddingModelConfig(database.embeddingModelId);
  const [queryEmbedding] = await embedTexts(config, [cleanQuery]);
  return databaseStore.listDatabaseEmbeddings(workspaceId, databaseId)
    .map((row) => ({
      nodeId: row.nodeId,
      title: row.title,
      path: row.path,
      content: row.content,
      updatedAt: row.updatedAt,
      score: cosineSimilarity(queryEmbedding, row.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 20)));
}

interface EmbeddingModelConfig {
  model: LLMModel;
  provider: LLMProvider;
}

function requireEmbeddingModelConfig(modelId: string): EmbeddingModelConfig {
  const model = llmStore.getModel(modelId);
  if (!model) throw new Error(`Embedding model not found: ${modelId}`);
  if (!model.embedding) throw new Error(`Selected model is not marked as an embedding model: ${model.name}`);
  const provider = llmStore.listProviders().find((item) => item.name === model.provider);
  if (!provider) throw new Error(`Provider not found for embedding model: ${model.provider}`);
  if (!provider.apiBase || !provider.apiKey || !model.modelId) {
    throw new Error(`Embedding provider is missing apiBase, apiKey, or modelId: ${provider.name}`);
  }
  return { model, provider };
}

async function embedTexts(config: EmbeddingModelConfig, input: string[], extraDebug: Partial<DatabaseVectorDebug> = {}): Promise<number[][]> {
  const requestUrl = getEmbeddingsUrl(config.provider.apiBase);
  const requestDebug: DatabaseVectorDebug = {
    stage: 'embedding_request',
    providerName: config.provider.name,
    modelId: config.model.modelId,
    requestUrl,
    inputCount: input.length,
    inputLengths: input.map((item) => item.length),
    ...extraDebug,
  };
  console.info('[database-vector:embed] request', requestDebug);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model.modelId,
      input,
    }),
  });

  const responseText = await response.text();
  const responseDebugBase: DatabaseVectorDebug = {
    ...requestDebug,
    stage: 'embedding_response',
    status: response.status,
    responseContentType: response.headers.get('content-type'),
  };

  if (!response.ok) {
    const debug = {
      ...responseDebugBase,
      responsePreview: responseText.slice(0, 1000),
    };
    console.warn('[database-vector:embed] failed response', debug);
    throw new DatabaseVectorError(`Embedding request failed with status ${response.status}`, debug);
  }

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    const debug = {
      ...responseDebugBase,
      stage: 'embedding_parse_json',
      responsePreview: responseText.slice(0, 1000),
    };
    console.warn('[database-vector:embed] invalid json', debug);
    throw new DatabaseVectorError('Embedding response is not valid JSON.', debug);
  }

  const responseData = isRecord(data) && Array.isArray(data.data) ? data.data : undefined;
  const embeddings = responseData
    ?.map((item) => isRecord(item) ? item.embedding : undefined)
    .filter((item): item is number[] => Array.isArray(item) && item.every((value) => typeof value === 'number'));
  const debug: DatabaseVectorDebug = {
    ...responseDebugBase,
    responseDataCount: responseData?.length,
    validEmbeddingCount: embeddings?.length ?? 0,
    embeddingDimensions: embeddings?.map((embedding) => embedding.length).slice(0, 10),
    responseKeys: isRecord(data) ? Object.keys(data) : undefined,
    responsePreview: previewEmbeddingResponse(data),
  };
  console.info('[database-vector:embed] parsed response', debug);

  if (!embeddings || embeddings.length !== input.length) {
    throw new DatabaseVectorError(
      `Embedding response does not match input length. expected=${input.length}, data=${responseData?.length ?? 0}, validEmbeddings=${embeddings?.length ?? 0}`,
      debug,
    );
  }
  return embeddings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function previewEmbeddingResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const data = Array.isArray(value.data)
    ? value.data.slice(0, 3).map((item) => {
        if (!isRecord(item)) return item;
        const embedding = Array.isArray(item.embedding) ? item.embedding : undefined;
        return {
          ...item,
          embedding: embedding ? `[number[${embedding.length}]]` : item.embedding,
        };
      })
    : value.data;
  return {
    ...value,
    data,
  };
}

function getEmbeddingsUrl(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  if (base.endsWith('/embeddings')) return base;
  return `${base}/embeddings`;
}

function normalizeIndexText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_INDEX_TEXT_LENGTH);
}

function stripHtml(content: string): string {
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index];
    ma += a[index] * a[index];
    mb += b[index] * b[index];
  }
  if (!ma || !mb) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

function buildDatabaseNodePath(node: { id: string; title: string; parentId: string | null }, nodes: Array<{ id: string; title: string; parentId: string | null }>): string {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const parts = [node.title || node.id];
  let parentId = node.parentId;
  let guard = 0;
  while (parentId && guard < 100) {
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.title || parent.id);
    parentId = parent.parentId;
    guard++;
  }
  return `/${parts.join('/')}`;
}
