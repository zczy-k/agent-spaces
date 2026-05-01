import { Router } from 'express';
import type { Request, Response } from 'express';
import * as taskService from '../services/task.js';

const router = Router({ mergeParams: true });

router.get('/', (req: Request<{ id: string }>, res: Response) => {
  const issueId = req.query.issueId as string | undefined;
  const tasks = taskService.list(req.params.id, issueId);
  res.json(tasks);
});

router.get('/:taskId', (req: Request<{ id: string; taskId: string }>, res: Response) => {
  const task = taskService.getById(req.params.id, req.params.taskId);
  if (!task) {
    res.status(404).json({ error: 'task not found' });
    return;
  }
  res.json(task);
});

router.post('/:taskId/retry', (req: Request<{ id: string; taskId: string }>, res: Response) => {
  const task = taskService.retry(req.params.id, req.params.taskId);
  if (!task) {
    res.status(404).json({ error: 'task not found' });
    return;
  }
  res.json(task);
});

router.post('/:taskId/cancel', (req: Request<{ id: string; taskId: string }>, res: Response) => {
  const task = taskService.cancel(req.params.id, req.params.taskId);
  if (!task) {
    res.status(404).json({ error: 'task not found' });
    return;
  }
  res.json(task);
});

export default router;
