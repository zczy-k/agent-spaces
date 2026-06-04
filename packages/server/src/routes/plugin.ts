import { Router } from 'express';
import type { Request, Response } from 'express';
import * as pluginService from '../services/plugin.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(pluginService.listPlugins());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/workflow', (_req: Request, res: Response) => {
  try {
    res.json(pluginService.listWorkflowPlugins());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/store/:pluginId/install', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    res.json(pluginService.installTemplatePlugin(req.params.pluginId));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:pluginId/enable', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    res.json(pluginService.setPluginEnabled(req.params.pluginId, true));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:pluginId/disable', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    res.json(pluginService.setPluginEnabled(req.params.pluginId, false));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:pluginId/config', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    res.json(pluginService.getPluginConfig(req.params.pluginId));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:pluginId/config', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    res.json(pluginService.savePluginConfig(req.params.pluginId, req.body || {}));
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:pluginId/workflow-nodes', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    res.json({ pluginId: req.params.pluginId, nodes: pluginService.getWorkflowNodes(req.params.pluginId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
