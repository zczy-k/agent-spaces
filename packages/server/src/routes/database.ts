import { Router } from 'express';
import type { Request, Response } from 'express';
import * as store from '../storage/database-store.js';
import * as databaseVector from '../services/database-vector.js';

const router = Router({ mergeParams: true });
const pendingContentSaves = new Map<string, { timer: NodeJS.Timeout; content: string }>();
const CONTENT_SAVE_IDLE_MS = 30_000;

const wid = (req: Request): string => req.params.id as string;
const databaseId = (req: Request): string => req.query.databaseId as string || store.getDefaultDatabase(wid(req)).id;

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

export default router;
