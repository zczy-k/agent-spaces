import { Router } from 'express';
import {
  listOutputStyles,
  createOutputStyle,
  updateOutputStyle,
  deleteOutputStyle,
} from '../services/output-style.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(listOutputStyles());
});

router.post('/', (req: Request, res: Response) => {
  const { name, content } = req.body as { name?: string; content?: string };
  if (!name || !content) {
    res.status(400).json({ error: 'name and content required' });
    return;
  }
  res.json(createOutputStyle(name, content));
});

router.put('/:id', (req: Request, res: Response) => {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
  const data = req.body as { name?: string; content?: string };
  const tmpl = updateOutputStyle(id, data);
  if (!tmpl) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(tmpl);
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
  const ok = deleteOutputStyle(id);
  if (!ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
