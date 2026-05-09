import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ensureDir, getDataDir } from '../storage/json-store.js';
import { listTemplates } from './agent.js';
import type { AgentConfig } from '@agent-spaces/shared';

export interface SkillInfo {
  name: string;
  filename: string;
  content: string;
  favorited: boolean;
  boundAgents: Array<{ id: string; name: string; avatarUrl?: string }>;
}

interface SkillMeta {
  favorites: string[];
}

function getSkillsDir(): string {
  return join(getDataDir(), 'skills');
}

function getSkillMetaPath(): string {
  return join(getSkillsDir(), '_meta.json');
}

function readMeta(): SkillMeta {
  const path = getSkillMetaPath();
  if (!existsSync(path)) return { favorites: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SkillMeta;
  } catch {
    return { favorites: [] };
  }
}

function writeMeta(meta: SkillMeta): void {
  ensureDir(getSkillsDir());
  writeFileSync(getSkillMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
}

export function listSkills(): SkillInfo[] {
  const agents = listTemplates();
  const skillsDir = getSkillsDir();
  const meta = readMeta();
  ensureDir(skillsDir);

  const skillFiles = readdirSync(skillsDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'));

  return skillFiles.map((filename) => {
    const content = readFileSync(join(skillsDir, filename), 'utf-8');
    const name = basename(filename, '.md');
    const boundAgents = agents
      .filter((a: AgentConfig) =>
        (a.skills || []).some((s: string) => {
          const skillName = s.replace(/\.md$/i, '');
          return skillName === name;
        }),
      )
      .map((a: AgentConfig) => ({
        id: a.id,
        name: a.name || 'Agent',
        avatarUrl: a.avatarUrl,
      }));

    return {
      name,
      filename,
      content,
      favorited: meta.favorites.includes(name),
      boundAgents,
    };
  });
}

export function importSkill(filename: string, content: string): SkillInfo {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const finalName = safeName.endsWith('.md') ? safeName : `${safeName}.md`;
  const skillsDir = getSkillsDir();
  ensureDir(skillsDir);
  writeFileSync(join(skillsDir, finalName), content, 'utf-8');
  return {
    name: basename(finalName, '.md'),
    filename: finalName,
    content,
    favorited: false,
    boundAgents: [],
  };
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

export function deleteSkill(name: string): boolean {
  const skillsDir = getSkillsDir();
  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = join(skillsDir, filename);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}
