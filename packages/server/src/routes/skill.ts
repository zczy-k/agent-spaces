import { Router } from 'express';
import { listSkills, importSkill, importSkillsBatch, importSkillFromStore, toggleFavorite, toggleEnabled, toggleAllEnabled, updateSkillContent, deleteSkill, checkSkillSync, syncSkills, importSkillsFromGit } from '../services/skill.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(listSkills());
});

router.get('/sync-check', (_req: Request, res: Response) => {
  res.json(checkSkillSync());
});

router.post('/sync', (req: Request, res: Response) => {
  const { items } = req.body as { items?: Array<{ agentId: string; skillName: string }> };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items required' });
    return;
  }
  const synced = syncSkills(items);
  res.json({ synced });
});

router.post('/import', (req: Request, res: Response) => {
  const { filename, content, group } = req.body as { filename?: string; content?: string; group?: string };
  if (!filename || !content) {
    res.status(400).json({ error: 'filename and content required' });
    return;
  }
  const skill = importSkill(filename, content, group);
  res.json(skill);
});

router.post('/import-batch', (req: Request, res: Response) => {
  const { items } = req.body as { items?: Array<{ name: string; content: string; group?: string }> };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items required' });
    return;
  }
  const skills = importSkillsBatch(items);
  res.json(skills);
});

router.post('/import-store', (req: Request, res: Response) => {
  const { path, group } = req.body as { path?: string; group?: string };
  if (!path) {
    res.status(400).json({ error: 'path required' });
    return;
  }
  const skill = importSkillFromStore(path, group || '');
  if (!skill) {
    res.status(404).json({ error: 'Store skill not found' });
    return;
  }
  res.json(skill);
});

router.post('/import-git', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'url required' });
    return;
  }
  try {
    const skills = importSkillsFromGit(url);
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Git clone failed' });
  }
});

router.post('/:name/favorite', (req: Request, res: Response) => {
  const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
  const favorited = toggleFavorite(name);
  res.json({ favorited });
});

router.post('/:name/toggle', (req: Request, res: Response) => {
  const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
  const enabled = toggleEnabled(name);
  res.json({ enabled });
});

router.post('/toggle-all', (req: Request, res: Response) => {
  const { names, enabled } = req.body as { names?: string[]; enabled?: boolean };
  if (!Array.isArray(names) || typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'names and enabled required' });
    return;
  }
  toggleAllEnabled(names, enabled);
  res.json({ success: true });
});

router.put('/:name', (req: Request, res: Response) => {
  const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
  const { content } = req.body as { content?: string };
  if (content === undefined) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  const ok = updateSkillContent(name, content);
  if (!ok) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }
  res.json({ success: true });
});

router.delete('/:name', (req: Request, res: Response) => {
  const name = typeof req.params.name === 'string' ? req.params.name : req.params.name[0];
  const ok = deleteSkill(name);
  if (!ok) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
