import { Router } from 'express';
import { listSkills, importSkill, toggleFavorite } from '../services/skill.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(listSkills());
});

router.post('/import', (req: Request, res: Response) => {
  const { filename, content } = req.body as { filename?: string; content?: string };
  if (!filename || !content) {
    res.status(400).json({ error: 'filename and content required' });
    return;
  }
  const skill = importSkill(filename, content);
  res.json(skill);
});

router.post('/:name/favorite', (req: Request, res: Response) => {
  const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
  const favorited = toggleFavorite(name);
  res.json({ favorited });
});

export default router;
