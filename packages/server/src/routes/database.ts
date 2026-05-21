import { Router } from 'express';
import type { Request, Response } from 'express';
import * as store from '../storage/database-store.js';

const router = Router({ mergeParams: true });

const wid = (req: Request): string => req.params.id as string;

// List all nodes
router.get('/', (req: Request, res: Response) => {
  res.json(store.listNodes(wid(req)));
});

// Get single node
router.get('/:nodeId', (req: Request, res: Response) => {
  const node = store.getNode(wid(req), req.params.nodeId as string);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Create node
router.post('/', (req: Request, res: Response) => {
  const node = store.createNode(wid(req), req.body);
  res.status(201).json(node);
});

// Update node
router.put('/:nodeId', (req: Request, res: Response) => {
  const node = store.updateNode(wid(req), req.params.nodeId as string, req.body);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Move node (change parent)
router.put('/:nodeId/move', (req: Request, res: Response) => {
  const { parentId } = req.body as { parentId: string | null };
  const node = store.moveNode(wid(req), req.params.nodeId as string, parentId ?? null);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Trash node (soft delete)
router.put('/:nodeId/trash', (req: Request, res: Response) => {
  const node = store.trashNode(wid(req), req.params.nodeId as string);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Restore node from trash
router.put('/:nodeId/restore', (req: Request, res: Response) => {
  const node = store.restoreNode(wid(req), req.params.nodeId as string);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  res.json(node);
});

// Delete node permanently
router.delete('/:nodeId', (req: Request, res: Response) => {
  if (!store.deleteNode(wid(req), req.params.nodeId as string)) {
    return res.status(404).json({ error: 'Node not found' });
  }
  res.json({ ok: true });
});

export default router;
