import { Router } from 'express';
import type { Request, Response } from 'express';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'crypto';
import * as svc from '../services/workflow-ui.js';

const router = Router();

// CRUD
router.get('/', (_req: Request, res: Response) => {
  try { res.json(svc.listProjects()); }
  catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, type, tags } = req.body;
    if (!name || !type) { res.status(400).json({ error: 'name and type are required' }); return; }
    if (type !== 'react' && type !== 'html') { res.status(400).json({ error: 'type must be "react" or "html"' }); return; }
    res.json(svc.createProject({ name, description, type, tags }));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try { res.json(svc.getProject(req.params.id)); }
  catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

router.put('/:id', (req: Request<{ id: string }>, res: Response) => {
  try { res.json(svc.updateProject(req.params.id, req.body)); }
  catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  try { svc.deleteProject(req.params.id); res.json({ ok: true }); }
  catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Files
router.get('/:id/files', (req: Request<{ id: string }>, res: Response) => {
  try { res.json(svc.getFileTree(req.params.id)); }
  catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

router.get('/:id/files/content', (req: Request<{ id: string }, any, any, { path?: string }>, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ error: 'path query parameter is required' }); return; }
    res.json({ content: svc.readFile(req.params.id, filePath) });
  } catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

router.put('/:id/files/content', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) { res.status(400).json({ error: 'path and content are required' }); return; }
    svc.writeFile(req.params.id, filePath, content);
    res.json({ ok: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/:id/configs/content', (req: Request<{ id: string }, any, any, { path?: string }>, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ error: 'path query parameter is required' }); return; }
    res.json({ value: svc.readConfig(req.params.id, filePath) });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id/configs/content', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { path: filePath, value } = req.body;
    if (!filePath || value === undefined) { res.status(400).json({ error: 'path and value are required' }); return; }
    svc.writeConfig(req.params.id, filePath, value);
    res.json({ ok: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.put('/:id/data/content', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { path: filePath, content, encoding } = req.body;
    if (!filePath || content === undefined) { res.status(400).json({ error: 'path and content are required' }); return; }
    const data = encoding === 'base64' ? Buffer.from(String(content), 'base64') : String(content);
    const size = svc.writeDataFile(req.params.id, filePath, data);
    res.json({ ok: true, path: `data/${filePath}`, size });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Avatar upload
router.post('/:id/avatar', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || !dataUrl.startsWith('data:')) { res.status(400).json({ error: 'Invalid dataUrl' }); return; }
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) { res.status(400).json({ error: 'Invalid base64 data' }); return; }
    const [, mime, base64] = match;
    const extByMime: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = extByMime[mime.toLowerCase()];
    if (!ext) { res.status(400).json({ error: 'Unsupported image type' }); return; }

    const project = svc.getProject(req.params.id);

    // Remove old avatar file
    if (project.avatarUrl) {
      const oldPath = join(svc.store.getProjectDir(project.id), project.avatarUrl);
      if (existsSync(oldPath)) rmSync(oldPath, { force: true });
    }

    const filename = `avatar.${ext}`;
    const dir = svc.store.getProjectDir(project.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), Buffer.from(base64, 'base64'));

    const updated = svc.updateProject(req.params.id, { avatarUrl: filename });
    res.json({ url: updated.avatarUrl });
  } catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

// Serve project avatar
router.get('/:id/avatar', (req: Request<{ id: string }>, res: Response) => {
  try {
    const project = svc.getProject(req.params.id);
    if (!project.avatarUrl) { res.status(404).json({ error: 'No avatar' }); return; }
    const filePath = join(svc.store.getProjectDir(project.id), project.avatarUrl);
    if (!existsSync(filePath)) { res.status(404).json({ error: 'Avatar file not found' }); return; }
    res.sendFile(filePath);
  } catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

// ZIP Export
router.get('/:id/export', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const zip = await svc.exportZip(req.params.id);
    const project = svc.getProject(req.params.id);
    const name = (project?.name ?? 'project').replace(/[^\w\-.]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);
    res.send(zip);
  } catch (error: any) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
});

// ZIP Import
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { zip, name, type, description } = req.body;
    if (!zip) { res.status(400).json({ error: 'zip (base64) is required' }); return; }
    const buffer = Buffer.from(zip, 'base64');
    const project = await svc.importZip(buffer, { name, type, description });
    res.json(project);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
