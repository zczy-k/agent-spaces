import { Router, type Request, type Response } from 'express';
import { exec } from 'child_process';
import * as fileService from '../services/file.js';
import * as wsService from '../services/workspace.js';

const router = Router({ mergeParams: true });

router.get('/tree', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const path = (req.query.path as string) || '';
  const tree = await fileService.readTree(ws, path);
  res.json(tree);
});

router.get('/content', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const path = req.query.path as string;
  if (!path) { res.status(400).json({ error: 'path is required' }); return; }

  const result = await fileService.readFileContent(ws, path);
  if (!result) { res.status(404).json({ error: 'File not found' }); return; }
  res.json(result);
});

router.put('/content', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const { path, content } = req.body;
  if (!path || content === undefined) { res.status(400).json({ error: 'path and content are required' }); return; }

  const ok = await fileService.writeFileContent(ws, path, content);
  if (!ok) { res.status(500).json({ error: 'Failed to write file' }); return; }
  res.json({ ok: true });
});

router.delete('/', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const path = req.query.path as string;
  if (!path) { res.status(400).json({ error: 'path is required' }); return; }

  const ok = await fileService.deletePath(ws, path);
  if (!ok) { res.status(500).json({ error: 'Failed to delete' }); return; }
  res.json({ ok: true });
});

router.post('/reveal', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const relPath = req.query.path as string;
  const fullPath = relPath
    ? `${ws.boundDirs[0]}/${relPath}`
    : ws.boundDirs[0];

  const cmd = process.platform === 'darwin'
    ? `open "${fullPath}"`
    : process.platform === 'win32'
      ? `explorer "${fullPath}"`
      : `xdg-open "${fullPath}"`;

  exec(cmd, (err) => {
    if (err) { res.status(500).json({ error: 'Failed to reveal' }); return; }
    res.json({ ok: true });
  });
});

export default router;
