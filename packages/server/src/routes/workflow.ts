import { Router } from 'express';
import type { Request, Response } from 'express';
import * as workflowService from '../services/workflow.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const workflows = workflowService.listWorkflows();
    res.json(workflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:workflowId', (req: Request<{ workflowId: string }>, res: Response) => {
  try {
    const workflow = workflowService.getWorkflow(req.params.workflowId);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json(workflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const workflow = workflowService.createWorkflow(req.body);
    res.status(201).json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:workflowId', (req: Request<{ workflowId: string }>, res: Response) => {
  try {
    const workflow = workflowService.updateWorkflow(req.params.workflowId, req.body);
    res.json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:workflowId', (req: Request<{ workflowId: string }>, res: Response) => {
  try {
    workflowService.deleteWorkflow(req.params.workflowId);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:workflowId/duplicate', (req: Request<{ workflowId: string }>, res: Response) => {
  try {
    const workflow = workflowService.duplicateWorkflow(req.params.workflowId);
    res.status(201).json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
