import { Router } from 'express';
import { existsSync, statSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import multer from 'multer';
import { getDataDir } from '../storage/json-store.js';
import * as agentStore from '../storage/agent-store.js';
import * as databaseStore from '../storage/database-store.js';
import * as kanbanStore from '../storage/kanban-store.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const CATEGORIES: Record<string, { path: string; label: string; group: string }> = {
  'auth':               { path: 'auth.json',               label: 'Authentication',        group: 'config' },
  'user-settings':      { path: 'user-settings.json',      label: 'User Settings',         group: 'config' },
  'npm-settings':       { path: 'npm-settings.json',       label: 'NPM Settings',          group: 'config' },
  'robot-accounts':     { path: 'robot-accounts.json',     label: 'Robot Accounts',        group: 'config' },
  'speech-recognition': { path: 'speech-recognition.json', label: 'Speech Recognition',    group: 'config' },
  'llm':                { path: 'llm',                     label: 'LLM Models & Providers', group: 'ai' },
  'agents':             { path: 'agents',                  label: 'Agent Usage',           group: 'content' },
  'database':           { path: 'database',                label: 'Document Database',     group: 'content' },
  'kanban':             { path: 'kanban',                  label: 'Kanban Boards',         group: 'content' },
  'output-styles':      { path: 'output-styles',           label: 'Output Styles',         group: 'customization' },
  'prompt-templates':   { path: 'prompt-templates',        label: 'Prompt Templates',      group: 'customization' },
  'subscriptions':      { path: 'subscriptions',           label: 'Subscriptions',         group: 'billing' },
  'skills':             { path: 'skills',                  label: 'Skills',                group: 'customization' },
  'mcps':               { path: 'mcps',                    label: 'MCP Servers',           group: 'customization' },
  'agent-templates':    { path: 'agent-templates',         label: 'Agent Templates',       group: 'customization' },
  'workflows':          { path: 'workflows',               label: 'Workflows',             group: 'content' },
};

// GET /api/data/export — stream zip backup
router.get('/export', (_req, res) => {
  const dataDir = getDataDir();
  const timestamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="agent-spaces-backup-${timestamp}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('[data-export] archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    } else {
      res.end();
    }
  });

  archive.pipe(res);

  for (const { path: relPath } of Object.values(CATEGORIES)) {
    const fullPath = join(dataDir, relPath);
    if (!existsSync(fullPath)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      archive.directory(fullPath, relPath);
    } else {
      archive.file(fullPath, { name: relPath });
    }
  }

  archive.finalize();
});

// POST /api/data/import/preview — upload zip, extract, return categories
router.post('/import/preview', upload.single('file'), (req, res) => {
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    const sessionId = randomUUID();
    const tempDir = join(tmpdir(), `agent-spaces-import-${sessionId}`);
    zip.extractAllTo(tempDir, true);

    const found: Array<{
      key: string;
      label: string;
      group: string;
      size: number;
      type: 'file' | 'directory';
      details: string;
    }> = [];

    for (const [key, { path: relPath, label, group }] of Object.entries(CATEGORIES)) {
      const fullPath = join(tempDir, relPath);
      if (!existsSync(fullPath)) continue;

      const stat = statSync(fullPath);
      const isDir = stat.isDirectory();

      found.push({
        key,
        label,
        group,
        size: isDir ? getDirSize(fullPath) : stat.size,
        type: isDir ? 'directory' : 'file',
        details: isDir ? `${countFiles(fullPath)} files` : formatSize(stat.size),
      });
    }

    activeImportSessions.set(sessionId, { tempDir, expiresAt: Date.now() + 30 * 60 * 1000 });
    res.json({ sessionId, categories: found });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/data/import/execute — restore selected categories
router.post('/import/execute', (req, res) => {
  const { sessionId, categories: selectedCategories } = req.body as {
    sessionId?: string;
    categories?: string[];
  };

  if (!sessionId || !selectedCategories?.length) {
    res.status(400).json({ error: 'sessionId and categories are required' });
    return;
  }

  const session = activeImportSessions.get(sessionId);
  if (!session || Date.now() > session.expiresAt) {
    res.status(410).json({ error: 'Import session expired. Please upload again.' });
    return;
  }

  const dataDir = getDataDir();
  const results: Record<string, 'ok' | 'skipped' | 'error'> = {};

  for (const categoryKey of selectedCategories) {
    const category = CATEGORIES[categoryKey];
    if (!category) { results[categoryKey] = 'skipped'; continue; }

    try {
      const srcPath = join(session.tempDir, category.path);
      const destPath = join(dataDir, category.path);

      if (!existsSync(srcPath)) { results[categoryKey] = 'skipped'; continue; }

      // Close SQLite connections before overwriting
      if (categoryKey === 'agents') agentStore.closeDb();
      else if (categoryKey === 'database') databaseStore.closeDb();
      else if (categoryKey === 'kanban') kanbanStore.closeDb();

      if (statSync(srcPath).isDirectory()) {
        if (existsSync(destPath)) rmSync(destPath, { recursive: true, force: true });
        cpSync(srcPath, destPath, { recursive: true });
      } else {
        cpSync(srcPath, destPath);
      }

      results[categoryKey] = 'ok';
    } catch (e) {
      console.error(`[data-import] error importing ${categoryKey}:`, e);
      results[categoryKey] = 'error';
    }
  }

  // Cleanup
  rmSync(session.tempDir, { recursive: true, force: true });
  activeImportSessions.delete(sessionId);

  res.json({ results });
});

// --- In-memory import sessions with auto-cleanup ---
const activeImportSessions = new Map<string, { tempDir: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeImportSessions) {
    if (now > session.expiresAt) {
      rmSync(session.tempDir, { recursive: true, force: true });
      activeImportSessions.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

// --- Helpers ---
function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(join(dir, entry.name)));
    } else {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

function getDirSize(dir: string): number {
  return listFilesRecursive(dir).reduce((sum, f) => sum + statSync(f).size, 0);
}

function countFiles(dir: string): number {
  return listFilesRecursive(dir).length;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default router;
