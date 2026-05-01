import { Router, type Request, type Response } from 'express';
import { gitStatus, gitDiff, gitLog } from '../adapters/git.js';

const router = Router({ mergeParams: true });

router.get('/status', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const result = await gitStatus(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/diff', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const filePath = req.query.path as string | undefined;
    const result = await gitDiff(req.params.id, filePath);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/log', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const maxCount = parseInt(req.query.maxCount as string) || 50;
    const result = await gitLog(req.params.id, maxCount);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
