import type { Request, Response, NextFunction } from 'express';

const SECRET = process.env.AGENT_SPACES_SECRET;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!SECRET) return next();

  const openPaths = ['/api/health', '/api/auth/login', '/api/auth/check'];
  if (openPaths.includes(req.path)) return next();

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (auth.slice(7) !== SECRET) {
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }

  next();
}

export function verifyToken(token: string | null): boolean {
  if (!SECRET) return true;
  if (!token) return false;
  return token === SECRET;
}
