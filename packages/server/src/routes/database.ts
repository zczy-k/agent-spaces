import { Router } from 'express';
import type { Request, Response } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentConfig, BuiltInAgentToolName } from '@agent-spaces/shared';
import * as store from '../storage/database-store.js';
import * as databaseVector from '../services/database-vector.js';
import * as agentService from '../services/agent.js';
import * as workspaceService from '../services/workspace.js';
import { createDatabaseFunctionTools } from '../services/builtin-tools/index.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import { getThinkingRuntimeConfig } from '../services/llm-model-config.js';
import { getDataDir, ensureDir } from '../storage/json-store.js';
import { generateAgentDesign } from '../agents/agent-designer.js';

const router = Router({ mergeParams: true });
const pendingContentSaves = new Map<string, { timer: NodeJS.Timeout; content: string }>();
const CONTENT_SAVE_IDLE_MS = 30_000;
const DATABASE_AGENT_ID = 'database-agent';
const DATABASE_AGENT_TOOLS: BuiltInAgentToolName[] = [
  'ListDatabases',
  'ListDatabaseNodes',
  'SearchDatabaseNodes',
  'QueryDatabaseVectors',
  'ReadDatabaseNode',
  'ListDatabaseNodeVersions',
  'CreateDatabaseNode',
  'WriteDatabaseNode',
  'DeleteDatabaseNode',
  'MoveDatabaseNode',
  'UpdateDatabaseNodeMeta',
];

const wid = (req: Request): string => req.params.id as string;
const databaseId = (req: Request): string => req.query.databaseId as string || store.getDefaultDatabase(wid(req)).id;

router.get('/agent-presets', (req: Request, res: Response) => {
  res.json([readDatabaseAgent(wid(req))]);
});

router.get('/agent-presets/:presetId', (req: Request, res: Response) => {
  if (req.params.presetId !== DATABASE_AGENT_ID) return res.status(404).json({ error: 'database agent not found' });
  res.json(readDatabaseAgent(wid(req)));
});

router.put('/agent-presets/:presetId', (req: Request, res: Response) => {
  if (req.params.presetId !== DATABASE_AGENT_ID) return res.status(404).json({ error: 'database agent not found' });
  res.json(writeDatabaseAgent(wid(req), req.body as Partial<AgentConfig>));
});

router.post('/agent-presets/test-connection', async (req: Request, res: Response) => {
  const result = await agentService.testConnection(wid(req), req.body as Partial<AgentConfig>);
  if (!result) return res.status(404).json({ error: 'workspace not found' });
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/agent-presets/generate', async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });
  try {
    res.json(await generateAgentDesign(prompt));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'agent generation failed' });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  const workspaceId = wid(req);
  const { message, history } = req.body as {
    message?: string;
    history?: Array<{ role: 'user' | 'agent'; content: string }>;
  };
  const prompt = message?.trim();
  if (!prompt) return res.status(400).json({ error: 'message is required' });

  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) return res.status(404).json({ error: 'workspace not found' });

  const agent = readDatabaseAgent(workspaceId);
  if (agent.enabled === false) return res.status(400).json({ error: 'database agent is disabled' });

  const workingDir = workspace.boundDirs[0] || process.cwd();
  const functionTools = createDatabaseFunctionTools(workspaceId, agent.tools);
  const runtime = createAgentRuntime({
    kind: agent.runtimeKind,
    provider: agent.modelProvider,
    model: agent.modelId,
    apiKey: agent.apiKey,
    baseURL: getRuntimeBaseURL(agent.modelProvider, agent.apiBase),
    adapterBaseURL: agent.apiBase,
    ...getThinkingRuntimeConfig(agent),
  });

  const result = await runtime.execute(buildDatabaseAgentPrompt(workspaceId, agent, prompt, history ?? []), workingDir, {
    maxTurns: 60,
    functionTools,
    mcpServers: {},
    skills: [],
    sandboxDirs: [],
    outputStyle: agent.outputStyle,
  });

  const finalMessage = result.success
    ? extractFinalMessage(result.output, result.summary)
    : result.error || extractFinalMessage(result.output, result.summary);
  res.status(result.success ? 200 : 400).json({ finalMessage });
});

router.get('/databases', (req: Request, res: Response) => {
  const databases = store.listDatabases(wid(req));
  res.json(databases.length > 0 ? databases : [store.getDefaultDatabase(wid(req))]);
});

router.post('/databases', (req: Request, res: Response) => {
  const database = store.createDatabase(wid(req), req.body);
  res.status(201).json(database);
});

router.put('/databases/:databaseId', (req: Request, res: Response) => {
  const database = store.updateDatabase(wid(req), req.params.databaseId as string, req.body);
  if (!database) return res.status(404).json({ error: 'Database not found' });
  res.json(database);
});

router.get('/databases/:databaseId/vector', (req: Request, res: Response) => {
  if (!store.getDatabase(wid(req), req.params.databaseId as string)) {
    return res.status(404).json({ error: 'Database not found' });
  }
  res.json(store.getVectorStats(wid(req), req.params.databaseId as string));
});

router.put('/databases/:databaseId/vector', (req: Request, res: Response) => {
  const { embeddingModelId } = req.body as { embeddingModelId?: string | null };
  const database = store.setDatabaseEmbeddingModel(wid(req), req.params.databaseId as string, embeddingModelId || null);
  if (!database) return res.status(404).json({ error: 'Database not found' });
  res.json(store.getVectorStats(wid(req), req.params.databaseId as string));
});

router.post('/databases/:databaseId/vector/index', async (req: Request, res: Response) => {
  try {
    res.json(await databaseVector.indexDatabaseVectors(wid(req), req.params.databaseId as string));
  } catch (error) {
    console.error('[database:vector:index] failed', {
      workspaceId: wid(req),
      databaseId: req.params.databaseId,
      error: error instanceof Error ? error.message : String(error),
      debug: error instanceof databaseVector.DatabaseVectorError ? error.debug : undefined,
    });
    res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
      debug: error instanceof databaseVector.DatabaseVectorError ? error.debug : undefined,
    });
  }
});

router.delete('/databases/:databaseId', (req: Request, res: Response) => {
  if (!store.deleteDatabase(wid(req), req.params.databaseId as string)) {
    return res.status(404).json({ error: 'Database not found' });
  }
  res.json({ ok: true });
});

// List all nodes
router.get('/', (req: Request, res: Response) => {
  res.json(store.listNodes(wid(req), databaseId(req)));
});

// Get single node
router.get('/:nodeId', (req: Request, res: Response) => {
  const node = store.getNode(wid(req), req.params.nodeId as string, databaseId(req));
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

router.get('/:nodeId/versions', (req: Request, res: Response) => {
  flushPendingContentSave(wid(req), databaseId(req), req.params.nodeId as string);
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
  const versions = store.listNodeVersions(wid(req), req.params.nodeId as string, databaseId(req), limit);
  res.json(versions);
});

// Create node
router.post('/', (req: Request, res: Response) => {
  const node = store.createNode(wid(req), { ...req.body, databaseId: databaseId(req) });
  res.status(201).json(node);
});

// Update node
router.put('/:nodeId', (req: Request, res: Response) => {
  const workspaceId = wid(req);
  const activeDatabaseId = databaseId(req);
  const nodeId = req.params.nodeId as string;
  const body = req.body as Record<string, unknown>;
  const { content, ...metadataUpdates } = body;

  let node = Object.keys(metadataUpdates).length > 0
    ? store.updateNode(workspaceId, nodeId, metadataUpdates, activeDatabaseId)
    : store.getNode(workspaceId, nodeId, activeDatabaseId);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  if (typeof content === 'string') {
    scheduleContentSave(workspaceId, activeDatabaseId, nodeId, content);
    node = { ...node, content, updatedAt: Date.now() };
  }

  res.json(node);
});

// Move node (change parent)
router.put('/:nodeId/move', (req: Request, res: Response) => {
  const { parentId } = req.body as { parentId: string | null };
  const node = store.moveNode(wid(req), req.params.nodeId as string, parentId ?? null, databaseId(req));
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Trash node (soft delete)
router.put('/:nodeId/trash', (req: Request, res: Response) => {
  const node = store.trashNode(wid(req), req.params.nodeId as string, databaseId(req));
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Restore node from trash
router.put('/:nodeId/restore', (req: Request, res: Response) => {
  const node = store.restoreNode(wid(req), req.params.nodeId as string, databaseId(req));
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Delete node permanently
router.delete('/:nodeId', (req: Request, res: Response) => {
  if (!store.deleteNode(wid(req), req.params.nodeId as string, databaseId(req))) {
    return res.status(404).json({ error: 'Node not found' });
  }
  res.json({ ok: true });
});

function scheduleContentSave(workspaceId: string, activeDatabaseId: string, nodeId: string, content: string): void {
  const key = `${workspaceId}:${activeDatabaseId}:${nodeId}`;
  const existing = pendingContentSaves.get(key);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    flushPendingContentSave(workspaceId, activeDatabaseId, nodeId);
  }, CONTENT_SAVE_IDLE_MS);
  pendingContentSaves.set(key, { timer, content });
}

function flushPendingContentSave(workspaceId: string, activeDatabaseId: string, nodeId: string): void {
  const key = `${workspaceId}:${activeDatabaseId}:${nodeId}`;
  const pending = pendingContentSaves.get(key);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingContentSaves.delete(key);
  store.updateNode(workspaceId, nodeId, { content: pending.content }, activeDatabaseId);
}

function databaseAgentPath(workspaceId: string): string {
  return join(getDataDir(), 'workspaces', workspaceId, 'database', 'agent.json');
}

function readDatabaseAgent(workspaceId: string): AgentConfig {
  const filePath = databaseAgentPath(workspaceId);
  if (!existsSync(filePath)) return defaultDatabaseAgent();

  try {
    return normalizeDatabaseAgent(JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<AgentConfig>);
  } catch {
    return defaultDatabaseAgent();
  }
}

function writeDatabaseAgent(workspaceId: string, input: Partial<AgentConfig>): AgentConfig {
  const agent = normalizeDatabaseAgent(input);
  ensureDir(join(getDataDir(), 'workspaces', workspaceId, 'database'));
  writeFileSync(databaseAgentPath(workspaceId), JSON.stringify(agent, null, 2), 'utf-8');
  return agent;
}

function defaultDatabaseAgent(): AgentConfig {
  return normalizeDatabaseAgent({
    name: 'Database AI',
    role: 'agent',
    description: 'Knowledge base assistant for Agent Spaces database documents.',
    runtimeKind: 'claude-code',
    modelProvider: undefined,
    modelId: '',
    apiBase: '',
    apiKey: '',
    systemPrompt: [
      'You are the database knowledge base assistant.',
      'Answer from Agent Spaces database content when possible.',
      'Use only the provided database tools for knowledge base operations.',
      'Return only the final answer in concise Markdown.',
    ].join('\n'),
    temperature: 0.2,
    maxTokens: 4096,
    enabled: true,
  });
}

function normalizeDatabaseAgent(input: Partial<AgentConfig>): AgentConfig {
  return {
    id: DATABASE_AGENT_ID,
    name: input.name?.trim() || 'Database AI',
    role: 'agent',
    description: input.description || '',
    runtimeKind: input.runtimeKind || 'claude-code',
    modelProvider: input.modelProvider,
    modelId: input.modelId || '',
    apiBase: input.apiBase || '',
    apiKey: input.apiKey || '',
    workingDir: '',
    mcps: {},
    skills: [],
    tools: DATABASE_AGENT_TOOLS,
    systemPrompt: input.systemPrompt || defaultDatabaseAgent().systemPrompt,
    outputStyle: input.outputStyle,
    temperature: input.temperature ?? 0.2,
    maxTokens: input.maxTokens ?? 4096,
    sandboxDirs: [],
    maxRetries: input.maxRetries,
    enabled: input.enabled ?? true,
  };
}

function buildDatabaseAgentPrompt(
  workspaceId: string,
  agent: AgentConfig,
  userMessage: string,
  history: Array<{ role: 'user' | 'agent'; content: string }>,
): string {
  const recentHistory = history
    .slice(-12)
    .map((item) => `${item.role === 'user' ? 'User' : 'Agent'}: ${item.content}`)
    .join('\n\n');

  return [
    agent.systemPrompt?.trim(),
    'Runtime constraints:',
    `- Current workspace id: ${workspaceId}`,
    '- MCP servers configured for this agent: none.',
    `- Available database tools: ${DATABASE_AGENT_TOOLS.map((tool) => `mcp__agent-spaces__${tool}`).join(', ')}.`,
    '- Use mcp__agent-spaces__ListDatabases when you need to know valid database IDs.',
    '- If the user does not specify a database, omit databaseId and the first database will be used automatically.',
    '- Never use the workspace id as databaseId.',
    '- Do not use filesystem, command, issue, channel, web, or other non-database tools for knowledge base work.',
    '- If you need database content, call the database tools before answering.',
    '- Return only the final answer in Markdown. Do not include tool logs or implementation traces.',
    recentHistory ? `Conversation history:\n${recentHistory}` : '',
    `User message:\n${userMessage}`,
  ].filter(Boolean).join('\n\n');
}

function extractFinalMessage(output: string[], fallback: string): string {
  const candidates = output
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^\[Usage\]/i.test(line)) return false;
      if (/^(Tool:|Todo:|Codex initialized\b|Claude Code initialized\b)/i.test(line)) return false;
      if (/^\[Reasoning\]/i.test(line)) return false;
      return true;
    });
  return candidates.at(-1) || fallback || '';
}

function getRuntimeBaseURL(provider?: string, apiBase?: string): string | undefined {
  if (
    provider === 'openai-responses-to-anthropic-messages'
    || provider === 'openai-chat-completions-to-anthropic-messages'
  ) return undefined;
  return apiBase;
}

export default router;
