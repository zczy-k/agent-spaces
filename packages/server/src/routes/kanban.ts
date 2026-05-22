import { Router } from 'express';
import type { Request, Response } from 'express';
import * as svc from '../services/kanban.js';

const router = Router({ mergeParams: true });

// GET /api/workspaces/:id/kanban — 获取或初始化 board
router.get('/', (req: Request<{ id: string }>, res: Response) => {
  const workspaceId = req.params.id;
  if (!workspaceId) { res.status(400).json({ error: 'workspaceId required' }); return; }
  try {
    const board = svc.ensureBoard(workspaceId);
    res.json(board);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/workspaces/:id/kanban — 保存完整 board 状态
router.put('/', (req: Request<{ id: string }>, res: Response) => {
  const workspaceId = req.params.id;
  if (!workspaceId) { res.status(400).json({ error: 'workspaceId required' }); return; }
  try {
    const board = svc.saveBoard(workspaceId, req.body);
    if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
    res.json(board);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
