import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, getDataDir } from '../storage/json-store.js';

export interface OutputStyleTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface OutputStyleMeta {
  templates: OutputStyleTemplate[];
}

function getDir(): string {
  return join(getDataDir(), 'output-styles');
}

function getMetaPath(): string {
  return join(getDir(), 'meta.json');
}

function readMeta(): OutputStyleMeta {
  const path = getMetaPath();
  if (!existsSync(path)) return { templates: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as OutputStyleMeta;
  } catch {
    return { templates: [] };
  }
}

function writeMeta(meta: OutputStyleMeta): void {
  ensureDir(getDir());
  writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
}

export function listOutputStyles(): OutputStyleTemplate[] {
  return readMeta().templates;
}

export function createOutputStyle(name: string, content: string): OutputStyleTemplate {
  const meta = readMeta();
  const now = new Date().toISOString();
  const id = `os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpl: OutputStyleTemplate = { id, name, content, createdAt: now, updatedAt: now };
  meta.templates.push(tmpl);
  writeMeta(meta);
  return tmpl;
}

export function updateOutputStyle(id: string, data: { name?: string; content?: string }): OutputStyleTemplate | null {
  const meta = readMeta();
  const tmpl = meta.templates.find((t) => t.id === id);
  if (!tmpl) return null;
  if (data.name !== undefined) tmpl.name = data.name;
  if (data.content !== undefined) tmpl.content = data.content;
  tmpl.updatedAt = new Date().toISOString();
  writeMeta(meta);
  return tmpl;
}

export function deleteOutputStyle(id: string): boolean {
  const meta = readMeta();
  const idx = meta.templates.findIndex((t) => t.id === id);
  if (idx < 0) return false;
  meta.templates.splice(idx, 1);
  writeMeta(meta);
  return true;
}
