import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { readJsonFile, writeJsonFile, ensureDir, getDataDir } from './json-store.js';
import { v4 as uuid } from 'uuid';

export interface WorkflowUiProject {
  id: string;
  name: string;
  description?: string;
  version: string;
  type: 'react' | 'html';
  tags?: string[];
  enabledPlugins?: string[];
  agentConfigId?: string;
  mainFile: string;
  icon?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  storeUrl?: string;
  storeChecksum?: string;
}

function baseDir(): string {
  return join(getDataDir(), 'workflows-ui');
}

function indexPath(): string {
  return join(baseDir(), 'index.json');
}

function projectDir(projectId: string): string {
  return join(baseDir(), projectId);
}

export function getProjectDir(projectId: string): string {
  return projectDir(projectId);
}

function manifestPath(projectId: string): string {
  return join(projectDir(projectId), 'manifest.json');
}

function srcDir(projectId: string): string {
  return join(projectDir(projectId), 'src');
}

function safeSrcPath(projectId: string, filePath: string): string {
  if (!filePath || filePath.includes('\0')) throw new Error('Invalid file path');
  if (filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath)) {
    throw new Error('Absolute paths are not allowed');
  }
  const root = resolve(srcDir(projectId));
  const target = resolve(root, filePath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes project src directory: ${filePath}`);
  }
  return target;
}

function safeProjectSubdirPath(projectId: string, dirName: 'configs' | 'data', filePath: string): string {
  if (!filePath || filePath.includes('\0')) throw new Error('Invalid file path');
  if (filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath)) {
    throw new Error('Absolute paths are not allowed');
  }
  const root = resolve(projectDir(projectId), dirName);
  const target = resolve(root, filePath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes project ${dirName} directory: ${filePath}`);
  }
  return target;
}

function touchProject(projectId: string): void {
  const manifest = readJsonFile<WorkflowUiProject>(manifestPath(projectId));
  if (!manifest) return;

  manifest.updatedAt = new Date().toISOString();
  writeJsonFile(manifestPath(projectId), manifest);
  const projects = listProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx !== -1) {
    projects[idx] = manifest;
    writeJsonFile(indexPath(), projects);
  }
}

// ---- CRUD ----

export function listProjects(): WorkflowUiProject[] {
  const index = readJsonFile<WorkflowUiProject[]>(indexPath());
  return index ?? [];
}

export function getProject(projectId: string): WorkflowUiProject | null {
  return listProjects().find(p => p.id === projectId) ?? null;
}

export function createProject(input: {
  name: string;
  description?: string;
  type: 'react' | 'html';
  tags?: string[];
  mainFile: string;
  files?: Record<string, string>;
}): WorkflowUiProject {
  const id = `wui_${Date.now()}_${uuid().slice(0, 8)}`;
  const now = new Date().toISOString();
  const project: WorkflowUiProject = {
    id,
    name: input.name,
    description: input.description,
    version: '1.0.0',
    type: input.type,
    tags: input.tags ?? [],
    mainFile: input.mainFile,
    createdAt: now,
    updatedAt: now,
  };

  ensureDir(projectDir(id));
  ensureDir(srcDir(id));
  writeJsonFile(manifestPath(id), project);

  if (input.files) {
    for (const [filePath, content] of Object.entries(input.files)) {
      const fullPath = join(srcDir(id), filePath);
      ensureDir(dirname(fullPath));
      writeFileSync(fullPath, content, 'utf-8');
    }
  }

  const projects = listProjects();
  projects.push(project);
  writeJsonFile(indexPath(), projects);

  return project;
}

export function updateProject(projectId: string, updates: Partial<Pick<WorkflowUiProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'agentConfigId' | 'mainFile' | 'icon' | 'avatarUrl'>>): WorkflowUiProject {
  const projects = listProjects();
  const index = projects.findIndex(p => p.id === projectId);
  if (index === -1) throw new Error(`Project not found: ${projectId}`);

  const updated = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  projects[index] = updated;
  writeJsonFile(indexPath(), projects);
  writeJsonFile(manifestPath(projectId), updated);
  return updated;
}

export function deleteProject(projectId: string): void {
  const projects = listProjects().filter(p => p.id !== projectId);
  writeJsonFile(indexPath(), projects);

  const dir = projectDir(projectId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// ---- Files ----

export function getFileTree(projectId: string): string[] {
  const dir = srcDir(projectId);
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  function walk(d: string, prefix: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(d, entry.name), rel);
      } else {
        files.push(rel);
      }
    }
  }
  walk(dir, '');
  return files;
}

export function readFile(projectId: string, filePath: string): string | null {
  const fullPath = safeSrcPath(projectId, filePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

export function writeFile(projectId: string, filePath: string, content: string): void {
  const fullPath = safeSrcPath(projectId, filePath);
  ensureDir(dirname(fullPath));
  writeFileSync(fullPath, content, 'utf-8');
  touchProject(projectId);
}

export function readConfig(projectId: string, filePath: string): unknown | null {
  const fullPath = safeProjectSubdirPath(projectId, 'configs', filePath);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

export function writeConfig(projectId: string, filePath: string, value: unknown): void {
  const fullPath = safeProjectSubdirPath(projectId, 'configs', filePath);
  ensureDir(dirname(fullPath));
  writeFileSync(fullPath, JSON.stringify(value, null, 2), 'utf-8');
  touchProject(projectId);
}

export function writeDataFile(projectId: string, filePath: string, content: Buffer | string): number {
  const fullPath = safeProjectSubdirPath(projectId, 'data', filePath);
  ensureDir(dirname(fullPath));
  writeFileSync(fullPath, content);
  touchProject(projectId);
  return Buffer.byteLength(content);
}

// ---- ZIP Import ----

export function importFromDir(extractDir: string, manifest: Partial<WorkflowUiProject> & { name: string; type: 'react' | 'html'; mainFile: string }): WorkflowUiProject {
  const id = `wui_${Date.now()}_${uuid().slice(0, 8)}`;
  const now = new Date().toISOString();
  const project: WorkflowUiProject = {
    id,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version ?? '1.0.0',
    type: manifest.type,
    tags: manifest.tags ?? [],
    enabledPlugins: manifest.enabledPlugins,
    agentConfigId: manifest.agentConfigId,
    mainFile: manifest.mainFile,
    icon: manifest.icon,
    avatarUrl: manifest.avatarUrl,
    createdAt: now,
    updatedAt: now,
    storeUrl: manifest.storeUrl,
    storeChecksum: manifest.storeChecksum,
  };

  const targetDir = projectDir(id);
  ensureDir(targetDir);
  writeJsonFile(manifestPath(id), project);

  const targetSrc = srcDir(id);
  ensureDir(targetSrc);
  if (existsSync(join(extractDir, 'src'))) {
    copyDirSync(join(extractDir, 'src'), targetSrc);
  } else {
    copyDirSync(extractDir, targetSrc);
  }

  const projects = listProjects();
  projects.push(project);
  writeJsonFile(indexPath(), projects);

  return project;
}

function copyDirSync(src: string, dest: string): void {
  ensureDir(dest);
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}
