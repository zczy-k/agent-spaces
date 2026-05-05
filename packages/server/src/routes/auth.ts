import { Router } from 'express';

const router = Router();

const SECRET = process.env.AGENT_SPACES_SECRET;

router.post('/login', (req, res) => {
  if (!SECRET) {
    res.json({ ok: true, noSecret: true });
    return;
  }

  const { secret } = req.body as { secret?: string };
  if (!secret || secret !== SECRET) {
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }

  res.json({ ok: true, token: SECRET });
});

router.get('/check', (req, res) => {
  if (!SECRET) {
    res.json({ authenticated: true, noSecret: true });
    return;
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== SECRET) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true });
});

export default router;
