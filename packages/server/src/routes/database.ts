import { Router } from 'express';
import type { Request, Response } from 'express';
import * as store from '../storage/database-store.js';

const router = Router({ mergeParams: true });

// List all nodes
router.get('/', (req: Request, res: Response) => {
  const workspaceId = req.params.id;
  res.json(store.listNodes(workspaceId));
});

// Get single node
router.get('/:nodeId', (req: Request, res: Response) => {
  const node = store.getNode(req.params.id, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Create node
router.post('/', (req: Request, res: Response) => {
  const node = store.createNode(req.params.id, req.body);
  res.status(201).json(node);
});

// Update node
router.put('/:nodeId', (req: Request, res: Response) => {
  const node = store.updateNode(req.params.id, req.params.nodeId, req.body);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Move node (change parent)
router.put('/:nodeId/move', (req: Request, res: Response) => {
  const { parentId } = req.body as { parentId: string | null };
  const node = store.moveNode(req.params.id, req.params.nodeId, parentId ?? null);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Trash node (soft delete)
router.put('/:nodeId/trash', (req: Request, res: Response) => {
  const node = store.trashNode(req.params.id, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Restore node from trash
router.put('/:nodeId/restore', (req: Request, res: Response) => {
  const node = store.restoreNode(req.params.id, req.params.nodeId);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Delete node permanently
router.delete('/:nodeId', (req: Request, res: Response) => {
  if (!store.deleteNode(req.params.id, req.params.nodeId)) {
    return res.status(404).json({ error: 'Node not found' });
  }
  res.json({ ok: true });
});

export default router;
