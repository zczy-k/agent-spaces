import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AgentConfig } from '@agent-spaces/shared';
import * as agentService from '../services/agent.js';

const router = Router({ mergeParams: true });

router.get('/usage/dashboard', (req: Request, res: Response) => {
  const days = Number(req.query.days ?? 30);
  res.json(agentService.usageDashboard(Number.isFinite(days) ? days : 30));
});

router.get('/presets', (req: Request<{ id: string }>, res: Response) => {
  const workspaceId = req.params.id;
  if (workspaceId) {
    const presets = agentService.listPresets(workspaceId);
    if (!presets) {
      res.status(404).json({ error: 'workspace not found' });
      return;
    }
    res.json(presets);
    return;
  }
  res.json(agentService.listGlobalPresets());
});

router.post('/presets', (req: Request<{ id: string }>, res: Response) => {
  const workspaceId = req.params.id;
  const body = req.body as Omit<Partial<AgentConfig>, 'id'>;
  if (workspaceId) {
    const preset = agentService.createPreset(workspaceId, body);
    if (!preset) {
      res.status(404).json({ error: 'workspace not found' });
      return;
    }
    res.status(201).json(preset);
    return;
  }
  res.status(201).json(agentService.createGlobalPreset(body));
});

router.post('/presets/test-connection', async (req: Request<{ id: string }>, res: Response) => {
  const workspaceId = req.params.id;
  const data = req.body as Partial<AgentConfig>;
  if (workspaceId) {
    const result = await agentService.testConnection(workspaceId, data);
    if (!result) {
      res.status(404).json({ error: 'workspace not found' });
      return;
    }
    res.status(result.success ? 200 : 400).json(result);
    return;
  }
  // Global: test connection without workspace context
  const { apiBase, apiKey, modelId, modelProvider } = data;
  const result = await agentService.testConnection('', { apiBase, apiKey, modelId, modelProvider });
  if (!result) {
    res.status(400).json({ error: 'connection test failed' });
    return;
  }
  res.status(result.success ? 200 : 400).json(result);
});

router.put('/presets/:presetId', (req: Request<{ id: string; presetId: string }>, res: Response) => {
  const workspaceId = req.params.id;
  const data = req.body as Partial<AgentConfig>;
  if (workspaceId) {
    const preset = agentService.updatePreset(workspaceId, req.params.presetId, data);
    if (!preset) {
      res.status(404).json({ error: 'agent preset not found' });
      return;
    }
    res.json(preset);
    return;
  }
  const preset = agentService.updateGlobalPreset(req.params.presetId, data);
  if (!preset) {
    res.status(404).json({ error: 'agent preset not found' });
    return;
  }
  res.json(preset);
});

router.delete('/presets/:presetId', (req: Request<{ id: string; presetId: string }>, res: Response) => {
  const workspaceId = req.params.id;
  if (workspaceId) {
    const deleted = agentService.deletePreset(workspaceId, req.params.presetId);
    if (deleted === null) {
      res.status(404).json({ error: 'workspace not found' });
      return;
    }
    if (!deleted) {
      res.status(404).json({ error: 'agent preset not found' });
      return;
    }
    res.status(204).end();
    return;
  }
  const deleted = agentService.deleteGlobalPreset(req.params.presetId);
  if (!deleted) {
    res.status(404).json({ error: 'agent preset not found' });
    return;
  }
  res.status(204).end();
});

router.get('/', (req: Request<{ id: string }>, res: Response) => {
  const sessions = agentService.list(req.params.id);
  res.json(sessions);
});

router.post('/start', (req: Request<{ id: string }>, res: Response) => {
  const { role, issueId } = req.body as { role: string; issueId?: string };
  if (!role) {
    res.status(400).json({ error: 'role is required' });
    return;
  }
  if (!agentService.isValidRole(role)) {
    res.status(400).json({ error: `invalid role: ${role}` });
    return;
  }
  const session = agentService.create(req.params.id, role as any);
  res.status(201).json(session);
});

router.post('/:agentId/stop', (req: Request<{ id: string; agentId: string }>, res: Response) => {
  const session = agentService.complete(req.params.id, req.params.agentId);
  if (!session) {
    res.status(404).json({ error: 'agent session not found' });
    return;
  }
  res.json(session);
});

router.get('/:agentId', (req: Request<{ id: string; agentId: string }>, res: Response) => {
  const session = agentService.getById(req.params.id, req.params.agentId);
  if (!session) {
    res.status(404).json({ error: 'agent session not found' });
    return;
  }
  res.json(session);
});

export default router;
