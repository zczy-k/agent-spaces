# Workflow UI 自定义页面 — 批次 1：后端数据层

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Workflow UI 的后端数据持久化、业务逻辑和 REST API，以及前端 SDK 适配器。

**Architecture:** 三层架构 — storage（JSON 持久化）→ service（业务逻辑 + ZIP 解压）→ routes（Express REST API）。SDK 模块作为前端统一调用层。复用现有 `json-store.ts` 的 `readJsonFile/writeJsonFile/ensureDir` 工具函数。

**Tech Stack:** Express 5, TypeScript, uuid, node:fs/path/child_process, @agent-spaces/shared

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `packages/server/src/storage/workflow-ui-store.ts` | JSON 持久化（index.json + per-project manifest） |
| Create | `packages/server/src/services/workflow-ui.ts` | 业务逻辑（CRUD + ZIP 解压 + 文件读写） |
| Create | `packages/server/src/routes/workflow-ui.ts` | REST API 路由 |
| Create | `packages/sdk/modules/workflow-ui.ts` | SDK API 适配器 |
| Modify | `packages/server/src/app.ts` | 注册 workflow-ui 路由 |
| Modify | `packages/sdk/src/index.ts` | 注册 SDK 模块 |

---

### Task 1: Storage 层

**Files:**
- Create: `packages/server/src/storage/workflow-ui-store.ts`

- [ ] **Step 1: 创建 store 文件**

```typescript
// packages/server/src/storage/workflow-ui-store.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readJsonFile, writeJsonFile, deleteFile, ensureDir, getDataDir } from './json-store.js';
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

function manifestPath(projectId: string): string {
  return join(projectDir(projectId), 'manifest.json');
}

function srcDir(projectId: string): string {
  return join(projectDir(projectId), 'src');
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
  files?: Record<string, string>; // path -> content
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

  // 写入 manifest
  ensureDir(projectDir(id));
  ensureDir(srcDir(id));
  writeJsonFile(manifestPath(id), project);

  // 写入初始文件
  if (input.files) {
    for (const [filePath, content] of Object.entries(input.files)) {
      const fullPath = join(srcDir(id), filePath);
      ensureDir(dirname(fullPath));
      writeFileSync(fullPath, content, 'utf-8');
    }
  }

  // 更新 index
  const projects = listProjects();
  projects.push(project);
  writeJsonFile(indexPath(), projects);

  return project;
}

export function updateProject(projectId: string, updates: Partial<Pick<WorkflowUiProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'agentConfigId' | 'mainFile'>>): WorkflowUiProject {
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
  const fullPath = join(srcDir(projectId), filePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

export function writeFile(projectId: string, filePath: string, content: string): void {
  const fullPath = join(srcDir(projectId), filePath);
  ensureDir(dirname(fullPath));
  writeFileSync(fullPath, content, 'utf-8');

  // 更新 updatedAt
  const manifest = readJsonFile<WorkflowUiProject>(manifestPath(projectId));
  if (manifest) {
    manifest.updatedAt = new Date().toISOString();
    writeJsonFile(manifestPath(projectId), manifest);
    const projects = listProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      projects[idx] = manifest;
      writeJsonFile(indexPath(), projects);
    }
  }
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
    createdAt: now,
    updatedAt: now,
    storeUrl: manifest.storeUrl,
    storeChecksum: manifest.storeChecksum,
  };

  // 创建目标目录，移动文件
  const targetDir = projectDir(id);
  ensureDir(targetDir);
  writeJsonFile(manifestPath(id), project);

  // 复制 src 目录
  const targetSrc = srcDir(id);
  ensureDir(targetSrc);
  if (existsSync(join(extractDir, 'src'))) {
    copyDirSync(join(extractDir, 'src'), targetSrc);
  } else {
    // 如果 ZIP 没有 src 子目录，直接复制所有文件到 src/
    copyDirSync(extractDir, targetSrc);
  }

  // 更新 index
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd packages/server && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: 无 store 相关错误（可能有其他文件的无关错误）

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/storage/workflow-ui-store.ts
git commit -m "feat(workflow-ui): add storage layer for custom pages"
```

---

### Task 2: Service 层

**Files:**
- Create: `packages/server/src/services/workflow-ui.ts`

- [ ] **Step 1: 创建 service 文件**

```typescript
// packages/server/src/services/workflow-ui.ts
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { v4 as uuid } from 'uuid';
import * as store from '../storage/workflow-ui-store.js';
import type { WorkflowUiProject } from '../storage/workflow-ui-store.js';

export { store };
export type { WorkflowUiProject };

// ---- CRUD ----

export function listProjects(): WorkflowUiProject[] {
  return store.listProjects();
}

export function getProject(projectId: string): WorkflowUiProject {
  const project = store.getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

export function createProject(input: {
  name: string;
  description?: string;
  type: 'react' | 'html';
  tags?: string[];
}): WorkflowUiProject {
  const mainFile = input.type === 'react' ? 'index.jsx' : 'index.html';
  const defaultFiles: Record<string, string> = input.type === 'react'
    ? {
        'index.jsx': `const { Button, Card, CardContent } = window.AgentSpacesUI;\n\nfunction App() {\n  return (\n    <Card>\n      <CardContent>\n        <Button>Hello World</Button>\n      </CardContent>\n    </Card>\n  );\n}\n\nexport default App;\n`,
      }
    : {
        'index.html': `<!DOCTYPE html>\n<html>\n<head><title>${input.name}</title></head>\n<body>\n  <h1>Hello World</h1>\n  <script>\n    console.log('loaded');\n  </script>\n</body>\n</html>`,
      };

  return store.createProject({
    ...input,
    mainFile,
    files: defaultFiles,
  });
}

export function updateProject(projectId: string, updates: Partial<Pick<WorkflowUiProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'agentConfigId' | 'mainFile'>>): WorkflowUiProject {
  return store.updateProject(projectId, updates);
}

export function deleteProject(projectId: string): void {
  store.deleteProject(projectId);
}

// ---- Files ----

export function getFileTree(projectId: string): string[] {
  return store.getFileTree(projectId);
}

export function readFile(projectId: string, filePath: string): string {
  const content = store.readFile(projectId, filePath);
  if (content === null) throw new Error(`File not found: ${filePath}`);
  return content;
}

export function writeFile(projectId: string, filePath: string, content: string): void {
  store.writeFile(projectId, filePath, content);
}

// ---- ZIP Import ----

export function importZip(zipBuffer: Buffer, manifest: { name?: string; type?: 'react' | 'html'; description?: string }): WorkflowUiProject {
  const extractDir = join(tmpdir(), `wui-import-${uuid()}`);
  ensureDir(extractDir);

  try {
    // 写入临时 ZIP 文件
    const zipPath = join(extractDir, 'upload.zip');
    writeFileSync(zipPath, zipBuffer);

    // 解压
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}/content' -Force"`, {
      stdio: 'pipe',
      timeout: 30_000,
    });

    // 查找 manifest
    const contentDir = join(extractDir, 'content');
    const manifestFile = findFile(contentDir, 'manifest.json') ?? findFile(contentDir, 'plugin.json');

    let projectManifest: Record<string, any> = {};
    if (manifestFile) {
      try {
        projectManifest = JSON.parse(require('fs').readFileSync(manifestFile, 'utf-8'));
      } catch { /* ignore invalid manifest */ }
    }

    // 确定 type
    const type = manifest.type ?? projectManifest.type ?? (findFile(contentDir, 'index.jsx') || findFile(contentDir, 'index.tsx') ? 'react' : 'html');
    const mainFile = type === 'react' ? 'index.jsx' : 'index.html';
    const name = manifest.name ?? projectManifest.name ?? 'Imported Project';

    // 源码目录：优先使用 src/ 子目录
    const srcBase = existsSync(join(contentDir, 'src')) ? join(contentDir, 'src') : contentDir;

    return store.importFromDir(srcBase, {
      name,
      type: type as 'react' | 'html',
      description: manifest.description ?? projectManifest.description,
      mainFile,
      tags: projectManifest.tags,
      enabledPlugins: projectManifest.enabledPlugins,
    });
  } finally {
    // 清理临时目录
    try { rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function findFile(dir: string, name: string): string | null {
  if (!existsSync(dir)) return null;
  for (const entry of require('fs').readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === name) return join(dir, name);
    if (entry.isDirectory()) {
      const found = findFile(join(dir, entry.name), name);
      if (found) return found;
    }
  }
  return null;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/server && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/services/workflow-ui.ts
git commit -m "feat(workflow-ui): add service layer with ZIP import"
```

---

### Task 3: REST API 路由

**Files:**
- Create: `packages/server/src/routes/workflow-ui.ts`

- [ ] **Step 1: 创建路由文件**

```typescript
// packages/server/src/routes/workflow-ui.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as svc from '../services/workflow-ui.js';

const router = Router();

// ---- CRUD ----

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(svc.listProjects());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, type, tags } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: 'name and type are required' });
      return;
    }
    if (type !== 'react' && type !== 'html') {
      res.status(400).json({ error: 'type must be "react" or "html"' });
      return;
    }
    res.json(svc.createProject({ name, description, type, tags }));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    res.json(svc.getProject(req.params.id));
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.put('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    res.json(svc.updateProject(req.params.id, req.body));
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    svc.deleteProject(req.params.id);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Files ----

router.get('/:id/files', (req: Request<{ id: string }>, res: Response) => {
  try {
    res.json(svc.getFileTree(req.params.id));
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.get('/:id/files/content', (req: Request<{ id: string }, any, any, { path?: string }>, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: 'path query parameter is required' });
      return;
    }
    res.json({ content: svc.readFile(req.params.id, filePath) });
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.put('/:id/files/content', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'path and content are required' });
      return;
    }
    svc.writeFile(req.params.id, filePath, content);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---- ZIP Import ----

router.post('/import', (req: Request, res: Response) => {
  try {
    // 接收 base64 编码的 ZIP 或 multipart
    // 简化版：前端发送 { zip: base64string, name?, type? }
    const { zip, name, type, description } = req.body;
    if (!zip) {
      res.status(400).json({ error: 'zip (base64) is required' });
      return;
    }
    const buffer = Buffer.from(zip, 'base64');
    const project = svc.importZip(buffer, { name, type, description });
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

- [ ] **Step 2: 在 app.ts 中注册路由**

在 `packages/server/src/app.ts` 中：
1. 顶部添加 import：`import workflowUiRouter from './routes/workflow-ui.js';`
2. 在 `app.use('/api/workflows', workflowRouter);` 附近添加：`app.use('/api/workflows-ui', workflowUiRouter);`

- [ ] **Step 3: 验证编译 + 启动**

Run: `cd packages/server && npx tsc --noEmit --pretty 2>&1 | head -20`

Run: `cd packages/server && timeout 5 npx tsx src/app.ts 2>&1 || true`
Expected: 服务启动无崩溃，可以看到路由注册

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/workflow-ui.ts packages/server/src/app.ts
git commit -m "feat(workflow-ui): add REST API routes and register in app.ts"
```

---

### Task 4: SDK 模块

**Files:**
- Create: `packages/sdk/src/modules/workflow-ui.ts`
- Modify: `packages/sdk/src/index.ts`

- [ ] **Step 1: 创建 SDK 模块**

```typescript
// packages/sdk/src/modules/workflow-ui.ts
import type { HttpClient } from '../client';

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
  createdAt: string;
  updatedAt: string;
  storeUrl?: string;
  storeChecksum?: string;
}

export function createWorkflowUiApi(http: HttpClient) {
  return {
    list: (): Promise<WorkflowUiProject[]> =>
      http.get('/api/workflows-ui'),

    get: (id: string): Promise<WorkflowUiProject> =>
      http.get(`/api/workflows-ui/${id}`),

    create: (data: { name: string; type: 'react' | 'html'; description?: string; tags?: string[] }): Promise<WorkflowUiProject> =>
      http.post('/api/workflows-ui', data),

    update: (id: string, data: Partial<Pick<WorkflowUiProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'agentConfigId' | 'mainFile'>>): Promise<WorkflowUiProject> =>
      http.put(`/api/workflows-ui/${id}`, data),

    delete_: (id: string): Promise<void> =>
      http.delete(`/api/workflows-ui/${id}`),

    getFileTree: (id: string): Promise<string[]> =>
      http.get(`/api/workflows-ui/${id}/files`),

    readFile: (id: string, filePath: string): Promise<{ content: string }> =>
      http.get(`/api/workflows-ui/${id}/files/content?path=${encodeURIComponent(filePath)}`),

    writeFile: (id: string, filePath: string, content: string): Promise<void> =>
      http.putVoid(`/api/workflows-ui/${id}/files/content`, { path: filePath, content }),

    importZip: (data: { zip: string; name?: string; type?: 'react' | 'html'; description?: string }): Promise<WorkflowUiProject> =>
      http.post('/api/workflows-ui/import', data),
  };
}
```

- [ ] **Step 2: 注册到 SDK index**

在 `packages/sdk/src/index.ts` 中添加 3 处：

1. 模块导出区域（约第 63 行后）：
```typescript
export { createWorkflowUiApi, type WorkflowUiProject } from './modules/workflow-ui';
```

2. import 区域（约第 106 行后）：
```typescript
import { createWorkflowUiApi } from './modules/workflow-ui';
```

3. SDK interface（约第 152 行后）：
```typescript
readonly workflowUi: ReturnType<typeof createWorkflowUiApi>;
```

4. createSDK 函数中（约第 206 行后）：
```typescript
workflowUi: createWorkflowUiApi(http),
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/sdk && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/modules/workflow-ui.ts packages/sdk/src/index.ts
git commit -m "feat(workflow-ui): add SDK module and register in index"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 批次 1 覆盖设计文档的 §1 数据模型与存储（全部 API 路由 + 持久化 + ZIP 导入 + SDK）
- [x] **Placeholder scan**: 无 TBD/TODO，所有代码完整
- [x] **Type consistency**: `WorkflowUiProject` 接口在 store、service、SDK 三处一致
