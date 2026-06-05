import { Router } from 'express';
import * as svc from '../services/chat.js';

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
  const {
    name,
    avatar,
    description,
    systemPrompt,
    provider,
    model,
    apiKey,
    baseURL,
    apiBase,
  } = req.body as {
    name?: string;
    avatar?: string;
    description?: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    apiKey?: string;
    baseURL?: string;
    apiBase?: string;
  };
  if (!name || !provider || !model) {
    res.status(400).json({ error: 'name, provider, and model are required' });
    return;
  }
  try {
    const agent = svc.createAgent({
      name,
      avatar,
      description,
      systemPrompt,
      provider,
      model,
      apiKey: apiKey ?? '',
      baseURL: baseURL || apiBase || undefined,
    });
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

export default router;
