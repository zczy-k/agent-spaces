import { Router } from 'express';
import * as workflowService from '../services/workflow.js';
import { broadcastToWorkspace } from '../ws/handler.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  try {
    const { id: workspaceId } = req.params;
    const workflows = workflowService.listWorkflows(workspaceId);
    res.json(workflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:workflowId', (req, res) => {
  try {
    const { id: workspaceId, workflowId } = req.params;
    const workflow = workflowService.getWorkflow(workspaceId, workflowId);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json(workflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { id: workspaceId } = req.params;
    const workflow = workflowService.createWorkflow(workspaceId, req.body);
    broadcastToWorkspace(workspaceId, 'workflow.created', { workspaceId, workflow });
    res.status(201).json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:workflowId', (req, res) => {
  try {
    const { id: workspaceId, workflowId } = req.params;
    const workflow = workflowService.updateWorkflow(workspaceId, workflowId, req.body);
    broadcastToWorkspace(workspaceId, 'workflow.updated', { workspaceId, workflow });
    res.json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:workflowId', (req, res) => {
  try {
    const { id: workspaceId, workflowId } = req.params;
    workflowService.deleteWorkflow(workspaceId, workflowId);
    broadcastToWorkspace(workspaceId, 'workflow.deleted', { workspaceId, workflowId });
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:workflowId/duplicate', (req, res) => {
  try {
    const { id: workspaceId, workflowId } = req.params;
    const workflow = workflowService.duplicateWorkflow(workspaceId, workflowId);
    broadcastToWorkspace(workspaceId, 'workflow.created', { workspaceId, workflow });
    res.status(201).json(workflow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
