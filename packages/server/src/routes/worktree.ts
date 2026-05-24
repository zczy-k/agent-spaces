import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  listWorkspaceWorktrees, getWorkspaceWorktree,
  createWorkspaceWorktree, deleteWorkspaceWorktree,
  getWorktreeDiff, createWorktreePR, mergeWorktreePR,
} from '../services/worktree.js';

export const worktreeRouter = Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1),
  branch: z.string().optional(),
  agentId: z.string().optional(),
  issueId: z.string().optional(),
  taskId: z.string().optional(),
});

const prSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
});

worktreeRouter.get('/', (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  res.json(listWorkspaceWorktrees(id));
});

worktreeRouter.post('/', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const input = createSchema.parse(req.body);
    const info = await createWorkspaceWorktree(id, input);
    res.status(201).json(info);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.get('/:wtId', (req: Request<{ id: string; wtId: string }>, res: Response) => {
  const { id, wtId } = req.params;
  const info = getWorkspaceWorktree(id, wtId);
  if (!info) return res.status(404).json({ error: 'Worktree not found' });
  res.json(info);
});

worktreeRouter.delete('/:wtId', async (req: Request<{ id: string; wtId: string }>, res: Response) => {
  try {
    const { id, wtId } = req.params;
    await deleteWorkspaceWorktree(id, wtId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.get('/:wtId/diff', async (req: Request<{ id: string; wtId: string }>, res: Response) => {
  try {
    const { id, wtId } = req.params;
    const diff = await getWorktreeDiff(id, wtId);
    res.type('text/plain').send(diff);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.post('/:wtId/pr', async (req: Request<{ id: string; wtId: string }>, res: Response) => {
  try {
    const { id, wtId } = req.params;
    const { title, body } = prSchema.parse(req.body);
    const prUrl = await createWorktreePR(id, wtId, title, body);
    res.json({ prUrl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.post('/:wtId/merge', async (req: Request<{ id: string; wtId: string }>, res: Response) => {
  try {
    const { id, wtId } = req.params;
    await mergeWorktreePR(id, wtId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
