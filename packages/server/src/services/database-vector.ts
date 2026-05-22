import { createHash } from 'node:crypto';
import type { AgentConfig, DatabaseVectorIndexResult, DatabaseVectorSearchResult } from '@agent-spaces/shared';
import * as databaseStore from '../storage/database-store.js';
import * as agentService from './agent.js';

const INDEX_BATCH_SIZE = 16;
const MAX_INDEX_TEXT_LENGTH = 24_000;

export async function indexDatabaseVectors(workspaceId: string, databaseId: string): Promise<DatabaseVectorIndexResult> {
  const database = databaseStore.getDatabase(workspaceId, databaseId);
  if (!database) throw new Error(`Database not found: ${databaseId}`);
  if (!database.embeddingAgentId) throw new Error('Embedding agent is not bound to this database.');

  const agent = requireEmbeddingAgent(database.embeddingAgentId);
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
    const embeddings = await embedTexts(agent, batch.map((item) => item.text));
    embeddings.forEach((embedding, offset) => {
      const item = batch[offset];
      databaseStore.upsertDatabaseEmbedding(workspaceId, databaseId, {
        nodeId: item.node.id,
        title: item.node.title,
        path: item.path,
        content: item.text,
        contentHash: hashText(item.text),
        embedding,
        modelId: agent.modelId || '',
        agentId: agent.id,
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
  if (!database.embeddingAgentId) throw new Error('Embedding agent is not bound to this database.');

  const cleanQuery = normalizeIndexText(query);
  if (!cleanQuery) throw new Error('query is required.');

  const agent = requireEmbeddingAgent(database.embeddingAgentId);
  const [queryEmbedding] = await embedTexts(agent, [cleanQuery]);
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

function requireEmbeddingAgent(agentId: string): AgentConfig {
  const agent = agentService.readAgentTemplate(agentId);
  if (!agent) throw new Error(`Embedding agent not found: ${agentId}`);
  if (!agent.apiBase || !agent.apiKey || !agent.modelId) {
    throw new Error(`Embedding agent is missing apiBase, apiKey, or modelId: ${agent.name}`);
  }
  return agent;
}

async function embedTexts(agent: AgentConfig, input: string[]): Promise<number[][]> {
  const response = await fetch(getEmbeddingsUrl(agent.apiBase || ''), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${agent.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: agent.modelId,
      input,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const embeddings = data.data?.map((item) => item.embedding).filter((item): item is number[] => Array.isArray(item));
  if (!embeddings || embeddings.length !== input.length) {
    throw new Error('Embedding response does not match input length.');
  }
  return embeddings;
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
