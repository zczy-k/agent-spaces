import { Router } from 'express';
import * as svc from '../services/chat.js';
import * as fileService from '../services/file.js';

const router = Router();

// GET /api/chat/agents — list all chat agents
router.get('/agents', (_req, res) => {
  try {
    res.json(svc.listAgents());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/agents — create agent (requires name, provider, model, apiKey)
router.post('/agents', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const provider = stringValue(body.provider) || stringValue(body.modelProvider);
  const model = stringValue(body.model) || stringValue(body.modelId);
  if (!name || !provider || !model) {
    res.status(400).json({ error: 'name, provider, and model are required' });
    return;
  }
  try {
    const agent = svc.createAgent(body as Parameters<typeof svc.createAgent>[0]);
    res.status(201).json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/chat/agents/:id — update agent
router.put('/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  try {
    const patch = normalizeChatAgentPatch(req.body);
    const agent = svc.updateAgent(id, patch);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function normalizeChatAgentPatch(body: unknown): Partial<Parameters<typeof svc.updateAgent>[1]> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const patch = { ...(body as Record<string, unknown>) } as Partial<Parameters<typeof svc.updateAgent>[1]> & {
    apiBase?: string;
  };
  if (!patch.baseURL && patch.apiBase) {
    patch.baseURL = patch.apiBase;
  }
  delete patch.apiBase;
  return patch;
}

// DELETE /api/chat/agents/:id — delete agent + its messages
router.delete('/agents/:id', (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  try {
    const deleted = svc.deleteAgent(id);
    if (!deleted) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/agents/:id/messages — list messages (?limit=50&before=msgId)
router.get('/agents/:id/messages', (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  try {
    const agent = svc.findAgent(id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const before = req.query.before as string | undefined;
    res.json(svc.listMessages(id, limit, before));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/chat/agents/:id/messages — clear messages
router.delete('/agents/:id/messages', (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  try {
    svc.clearMessages(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/agents/:id/workspace/tree - read chat agent working directory
router.get('/agents/:id/workspace/tree', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  try {
    const workspace = svc.getAgentWorkspace(id);
    if (!workspace) {
      res.status(404).json({ error: 'Agent workspace not found' });
      return;
    }
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const depth = req.query.depth ? Number(req.query.depth) : Infinity;
    res.json(await fileService.readTree(workspace, relPath, depth));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export default router;
