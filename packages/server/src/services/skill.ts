import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ensureDir, getDataDir } from '../storage/json-store.js';
import { listTemplates } from './agent.js';
import type { AgentConfig } from '@agent-spaces/shared';

export interface SkillInfo {
  name: string;
  description: string;
  filename: string;
  content: string;
  favorited: boolean;
  enabled: boolean;
  group: string;
  boundAgents: Array<{ id: string; name: string; avatarUrl?: string }>;
}

interface SkillMeta {
  favorites: string[];
  groups: Record<string, string>;
  disabled: string[];
}

const SKILL_FILE = 'SKILL.md';

function getSkillsDir(): string {
  return join(getDataDir(), 'skills');
}

function getSkillMetaPath(): string {
  return join(getSkillsDir(), '_meta.json');
}

function readMeta(): SkillMeta {
  const path = getSkillMetaPath();
  if (!existsSync(path)) return { favorites: [], groups: {}, disabled: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SkillMeta;
  } catch {
    return { favorites: [], groups: {}, disabled: [] };
  }
}

function writeMeta(meta: SkillMeta): void {
  ensureDir(getSkillsDir());
  writeFileSync(getSkillMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
}

/** Migrate flat .md files to folder/{SKILL_FILE} format */
function migrateFlatFiles(): void {
  const skillsDir = getSkillsDir();
  if (!existsSync(skillsDir)) return;

  const entries = readdirSync(skillsDir);
  for (const entry of entries) {
    if (!entry.endsWith('.md') || entry.startsWith('_')) continue;
    const filePath = join(skillsDir, entry);
    if (!statSync(filePath).isFile()) continue;

    const name = basename(entry, '.md');
    const folderPath = join(skillsDir, name);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
      const content = readFileSync(filePath, 'utf-8');
      writeFileSync(join(folderPath, SKILL_FILE), content, 'utf-8');
    }
    unlinkSync(filePath);
  }
}

export function listSkills(): SkillInfo[] {
  migrateFlatFiles();

  const agents = listTemplates();
  const skillsDir = getSkillsDir();
  const meta = readMeta();
  ensureDir(skillsDir);

  const folders = readdirSync(skillsDir)
    .filter((f) => {
      if (f.startsWith('_')) return false;
      const p = join(skillsDir, f);
      return statSync(p).isDirectory();
    });

  return folders.map((folderName) => {
    const skillFile = join(skillsDir, folderName, SKILL_FILE);
    const content = existsSync(skillFile) ? readFileSync(skillFile, 'utf-8') : '';
    const fm = parseFrontmatter(content);
    const boundAgents = agents
      .filter((a: AgentConfig) =>
        (a.skills || []).some((s: string) => {
          const skillName = s.replace(/\.md$/i, '');
          return skillName === folderName;
        }),
      )
      .map((a: AgentConfig) => ({
        id: a.id,
        name: a.name || 'Agent',
        avatarUrl: a.avatarUrl,
      }));

    return {
      name: folderName,
      description: fm.description || '',
      filename: `${folderName}/${SKILL_FILE}`,
      content,
      favorited: meta.favorites.includes(folderName),
      enabled: !meta.disabled.includes(folderName),
      group: meta.groups[folderName] || '',
      boundAgents,
    };
  });
}

interface Frontmatter {
  name: string | null;
  description: string | null;
}

function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: null, description: null };
  const lines = match[1].split(/\r?\n/);
  let name: string | null = null;
  let description: string | null = null;
  for (const line of lines) {
    if (/^\s*name\s*:/i.test(line)) {
      name = line.split(':', 2)[1].trim() || null;
    } else if (/^\s*description\s*:/i.test(line)) {
      description = line.split(':', 2)[1].trim() || null;
    }
  }
  return { name, description };
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
}

function writeSkillFolder(name: string, content: string): string {
  const skillsDir = getSkillsDir();
  const folderName = sanitizeFolderName(name);
  const folderPath = join(skillsDir, folderName);
  ensureDir(folderPath);
  writeFileSync(join(folderPath, SKILL_FILE), content, 'utf-8');
  return folderName;
}

export function importSkill(filename: string, content: string, group?: string): SkillInfo {
  const fm = parseFrontmatter(content);
  const rawName = fm.name || basename(filename, '.md');
  const folderName = writeSkillFolder(rawName, content);

  if (group) {
    const meta = readMeta();
    meta.groups[folderName] = group;
    writeMeta(meta);
  }

  return {
    name: folderName,
    description: fm.description || '',
    filename: `${folderName}/${SKILL_FILE}`,
    content,
    favorited: false,
    enabled: true,
    group: group || '',
    boundAgents: [],
  };
}

export function importSkillsBatch(items: Array<{ name: string; content: string; group?: string }>): SkillInfo[] {
  const meta = readMeta();
  const results: SkillInfo[] = [];

  for (const item of items) {
    const folderName = writeSkillFolder(item.name, item.content);
    if (item.group) {
      meta.groups[folderName] = item.group;
    }
    const fm = parseFrontmatter(item.content);
    results.push({
      name: folderName,
      description: fm.description || '',
      filename: `${folderName}/${SKILL_FILE}`,
      content: item.content,
      favorited: false,
      enabled: true,
      group: item.group || '',
      boundAgents: [],
    });
  }

  writeMeta(meta);
  return results;
}

export function toggleFavorite(name: string): boolean {
  const meta = readMeta();
  const idx = meta.favorites.indexOf(name);
  if (idx >= 0) {
    meta.favorites.splice(idx, 1);
  } else {
    meta.favorites.push(name);
  }
  writeMeta(meta);
  return idx < 0;
}

export function toggleEnabled(name: string): boolean {
  const meta = readMeta();
  const idx = meta.disabled.indexOf(name);
  if (idx >= 0) {
    meta.disabled.splice(idx, 1);
  } else {
    meta.disabled.push(name);
  }
  writeMeta(meta);
  return idx >= 0; // true = now enabled
}

export function toggleAllEnabled(names: string[], enabled: boolean): void {
  const meta = readMeta();
  if (enabled) {
    meta.disabled = meta.disabled.filter((n) => !names.includes(n));
  } else {
    const set = new Set(meta.disabled);
    for (const n of names) set.add(n);
    meta.disabled = [...set];
  }
  writeMeta(meta);
}

export function updateSkillContent(name: string, content: string): boolean {
  const skillsDir = getSkillsDir();
  const filePath = join(skillsDir, name, SKILL_FILE);
  if (!existsSync(filePath)) return false;
  writeFileSync(filePath, content, 'utf-8');
  return true;
}

export function deleteSkill(name: string): boolean {
  const skillsDir = getSkillsDir();
  const folderPath = join(skillsDir, name);
  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) return false;
  rmSync(folderPath, { recursive: true, force: true });

  // Clean meta
  const meta = readMeta();
  meta.favorites = meta.favorites.filter((n) => n !== name);
  delete meta.groups[name];
  meta.disabled = meta.disabled.filter((n) => n !== name);
  writeMeta(meta);

  return true;
}

export interface SkillSyncItem {
  agentId: string;
  agentName: string;
  skillName: string;
  globalMtime: string;
  agentMtime: string;
}

export function checkSkillSync(): SkillSyncItem[] {
  migrateFlatFiles();

  const globalSkillsDir = getSkillsDir();
  const agents = listTemplates();
  const result: SkillSyncItem[] = [];

  for (const agent of agents) {
    const skillNames = (agent.skills || []).map((s: string) => s.replace(/\.md$/i, ''));
    if (skillNames.length === 0) continue;

    const agentSkillsDir = join(getDataDir(), 'agent-templates', agent.id, 'skills');

    for (const skillName of skillNames) {
      const globalFile = join(globalSkillsDir, skillName, SKILL_FILE);
      const agentFile = join(agentSkillsDir, `${skillName}.md`);

      if (!existsSync(globalFile)) continue;
      if (!existsSync(agentFile)) continue;

      const globalStat = statSync(globalFile);
      const agentStat = statSync(agentFile);

      if (globalStat.mtimeMs > agentStat.mtimeMs) {
        result.push({
          agentId: agent.id,
          agentName: agent.name || agent.id,
          skillName,
          globalMtime: globalStat.mtime.toISOString(),
          agentMtime: agentStat.mtime.toISOString(),
        });
      }
    }
  }

  return result;
}

export function syncSkills(items: Array<{ agentId: string; skillName: string }>): number {
  const globalSkillsDir = getSkillsDir();
  let synced = 0;

  for (const item of items) {
    const globalFile = join(globalSkillsDir, item.skillName, SKILL_FILE);
    const agentSkillsDir = join(getDataDir(), 'agent-templates', item.agentId, 'skills');
    const agentFile = join(agentSkillsDir, `${item.skillName}.md`);

    if (!existsSync(globalFile)) continue;

    ensureDir(agentSkillsDir);
    copyFileSync(globalFile, agentFile);
    synced++;
  }

  return synced;
}
