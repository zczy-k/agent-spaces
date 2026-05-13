# Editor Search & Monaco Multi-Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为编辑器面板添加代码搜索/文件名搜索功能，并通过 Monaco 多文件模型实现跨文件 Definition/References 跳转。

**Architecture:** 后端新增搜索路由和服务（ripgrep 优先，Node.js 降级），前端在编辑器面板加 Tab 切换（文件/搜索），搜索面板独立组件。Monaco 通过 Model 管理器注册多文件，打开文件时智能预加载同目录相关文件。

**Tech Stack:** Express 5, ripgrep (optional), Node.js fs, @monaco-editor/react, @base-ui/react Tabs, Zustand, next-intl

---

## File Structure

| Operation | File | Responsibility |
|-----------|------|----------------|
| Create | `packages/shared/src/types/search.ts` | CodeSearchResult + FileSearchResult 类型 |
| Modify | `packages/shared/src/types/index.ts` | 导出 search 类型 |
| Create | `packages/server/src/services/search.ts` | 搜索逻辑（ripgrep + Node.js 降级） |
| Create | `packages/server/src/routes/search.ts` | GET /code + GET /files 路由 |
| Modify | `packages/server/src/app.ts` | 注册搜索路由 |
| Modify | `packages/web/src/stores/editor.ts` | 新增 jumpToPosition + pendingJump 状态 |
| Create | `packages/web/src/components/editor/search-panel.tsx` | 搜索面板 UI |
| Modify | `packages/web/src/components/editor/editor-panel.tsx` | Tab 切换（文件/搜索） |
| Create | `packages/web/src/lib/monaco-models.ts` | Monaco Model 管理器 |
| Modify | `packages/web/src/components/editor/code-editor.tsx` | 集成 Model 管理器 + 跳转 + 语言服务配置 |
| Modify | `packages/web/src/locales/zh.json` | 搜索相关中文翻译 |
| Modify | `packages/web/src/locales/en.json` | 搜索相关英文翻译 |

---

### Task 1: Shared 搜索类型定义

**Files:**
- Create: `packages/shared/src/types/search.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: 创建搜索类型文件**

```ts
// packages/shared/src/types/search.ts
export interface CodeSearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchLength: number;
}

export interface FileSearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface SearchCodeOptions {
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  filePattern?: string;
  maxResults?: number;
}
```

- [ ] **Step 2: 导出类型**

在 `packages/shared/src/types/index.ts` 末尾添加：

```ts
export * from './search.js';
```

- [ ] **Step 3: 构建验证**

Run: `cd packages/shared && pnpm build`
Expected: 编译成功，无类型错误

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/types/search.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add search result types for code and file search"
```

---

### Task 2: 后端搜索服务

**Files:**
- Create: `packages/server/src/services/search.ts`

- [ ] **Step 1: 实现搜索服务**

```ts
// packages/server/src/services/search.ts
import { execSync } from 'node:child_process';
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Workspace, CodeSearchResult, FileSearchResult, SearchCodeOptions } from '@agent-spaces/shared';
import { resolvePath } from './file.js';

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', '.DS_Store', '__pycache__', '.turbo', 'dist', 'build', '.cache']);
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz', '.wasm']);
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_PRELOAD_SIZE = 500 * 1024; // 500KB

function isBinaryPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(`.${ext}`) || ext === path;
}

// --- ripgrep 实现 ---

interface RgMatch {
  type: 'match';
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
    absolute_offset: number;
    submatches: { start: number; end: number; match: { text: string } }[];
  };
}

function searchWithRipgrep(basePath: string, options: SearchCodeOptions): CodeSearchResult[] {
  const args = ['rg', '--json', '--max-count', String(options.maxResults || 200)];

  if (!options.caseSensitive) args.push('-i');
  if (options.regex) {
    args.push('--regexp', options.query);
  } else {
    args.push('--regexp', escapeRegex(options.query));
  }
  if (options.filePattern) args.push('--glob', options.filePattern);

  args.push('--', '.', basePath);

  try {
    const output = execSync(args.join(' '), {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    const results: CodeSearchResult[] = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed: RgMatch = JSON.parse(line);
        if (parsed.type !== 'match') continue;

        const filePath = relative(basePath, parsed.data.path.text);
        const text = parsed.data.lines.text.trimEnd();
        const sub = parsed.data.submatches[0];
        if (!sub) continue;

        // 计算 trim 后的偏移（只去右侧空白）
        const rstripLen = parsed.data.lines.text.length - text.length;
        let matchStart = sub.start - rstripLen;
        if (matchStart < 0) matchStart = 0;

        results.push({
          file: filePath,
          line: parsed.data.line_number,
          column: sub.start + 1,
          text,
          matchStart,
          matchLength: sub.end - sub.start,
        });

        if (results.length >= (options.maxResults || 200)) break;
      } catch { /* skip malformed lines */ }
    }
    return results;
  } catch (err: any) {
    // exit code 1 = no matches, return empty
    if (err.status === 1) return [];
    // exit code 2 = error, fall through to native
    throw err;
  }
}

// --- Node.js 原生实现 ---

async function searchWithNodeJs(basePath: string, options: SearchCodeOptions): Promise<CodeSearchResult[]> {
  const maxResults = options.maxResults || 200;
  const results: CodeSearchResult[] = [];
  const flags = options.caseSensitive ? 'g' : 'gi';
  let regex: RegExp;
  try {
    regex = options.regex ? new RegExp(options.query, flags) : new RegExp(escapeRegex(options.query), flags);
  } catch {
    return [];
  }

  async function walk(dir: string): Promise<void> {
    if (results.length >= maxResults) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (isBinaryPath(entry.name)) continue;

        const s = await stat(fullPath);
        if (s.size > MAX_FILE_SIZE) continue;

        if (options.filePattern) {
          const pattern = options.filePattern.replace(/\*/g, '');
          if (!entry.name.includes(pattern) && !fullPath.includes(pattern)) continue;
        }

        try {
          const content = await readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const relPath = relative(basePath, fullPath);

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) return;
            const text = lines[i];
            const match = regex.exec(text);
            if (match) {
              results.push({
                file: relPath,
                line: i + 1,
                column: match.index + 1,
                text: text.trimEnd(),
                matchStart: match.index,
                matchLength: match[0].length,
              });
            }
            regex.lastIndex = 0;
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  await walk(basePath);
  return results;
}

// --- 文件名搜索 ---

async function walkForFiles(dir: string, query: string, results: FileSearchResult[], basePath: string, limit: number): Promise<void> {
  if (results.length >= limit) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= limit) return;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);
    const relPath = relative(basePath, fullPath);

    if (entry.name.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        path: relPath,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      });
    }

    if (entry.isDirectory()) {
      await walkForFiles(fullPath, query, results, basePath, limit);
    }
  }
}

// --- 公开 API ---

export async function searchCode(workspace: Workspace, options: SearchCodeOptions): Promise<CodeSearchResult[]> {
  const basePath = resolvePath(workspace, '');
  if (!basePath) return [];

  // 先试 ripgrep
  try {
    return searchWithRipgrep(basePath, options);
  } catch {
    // 降级到 Node.js
  }

  return searchWithNodeJs(basePath, options);
}

export async function searchFiles(workspace: Workspace, query: string): Promise<FileSearchResult[]> {
  const basePath = resolvePath(workspace, '');
  if (!basePath) return [];

  const results: FileSearchResult[] = [];
  await walkForFiles(basePath, query, results, basePath, 100);
  return results;
}

export async function getDirectoryFiles(basePath: string, dir: string, extensions: string[], maxFiles: number, maxSize: number): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.size >= maxFiles) break;
      if (!entry.isFile()) continue;

      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      if (!extensions.includes(`.${ext}`)) continue;

      const fullPath = join(dir, entry.name);
      try {
        const s = await stat(fullPath);
        if (s.size > maxSize) continue;
        const content = await readFile(fullPath, 'utf-8');
        const relPath = relative(basePath, fullPath);
        files.set(relPath, content);
      } catch { /* skip */ }
    }
  } catch { /* dir not readable */ }
  return files;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/services/search.ts
git commit -m "feat(server): add search service with ripgrep + Node.js fallback"
```

---

### Task 3: 后端搜索路由 + 注册

**Files:**
- Create: `packages/server/src/routes/search.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: 创建搜索路由**

```ts
// packages/server/src/routes/search.ts
import { Router, type Request, type Response } from 'express';
import * as searchService from '../services/search.js';
import * as fileService from '../services/file.js';

const router = Router({ mergeParams: true });

router.get('/code', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  const results = await searchService.searchCode(ws, {
    query: q,
    regex: req.query.regex === 'true',
    caseSensitive: req.query.caseSensitive === 'true',
    filePattern: req.query.filePattern as string || undefined,
    maxResults: parseInt(req.query.maxResults as string) || 200,
  });

  res.json({ results, total: results.length });
});

router.get('/files', async (req: Request<{ id: string }>, res: Response) => {
  const ws = fileService.getWorkspace(req.params.id);
  if (!ws) { res.status(404).json({ error: 'Workspace not found' }); return; }

  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  const results = await searchService.searchFiles(ws, q);
  res.json({ results, total: results.length });
});

export default router;
```

- [ ] **Step 2: 注册路由到 app.ts**

在 `packages/server/src/app.ts` 的 import 区域添加：

```ts
import searchRouter from './routes/search.js';
```

在路由注册区域（`app.use('/api/workspaces/:id/git', gitRouter);` 之后）添加：

```ts
app.use('/api/workspaces/:id/search', searchRouter);
```

- [ ] **Step 3: 构建验证**

Run: `cd packages/server && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/routes/search.ts packages/server/src/app.ts
git commit -m "feat(server): add search routes for code content and file name search"
```

---

### Task 4: i18n 翻译

**Files:**
- Modify: `packages/web/src/locales/zh.json`
- Modify: `packages/web/src/locales/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `zh.json` 的 `"editor"` 对象内，在 `"openFileToEdit"` 之后添加：

```json
    "search": "搜索",
    "searchPlaceholder": "搜索文件内容...",
    "searchFiles": "搜索文件名",
    "searchCode": "搜索代码",
    "caseSensitive": "区分大小写",
    "useRegex": "正则表达式",
    "searchResults": "{count} 个结果，{files} 个文件",
    "tooManyResults": "结果过多，请缩小搜索范围",
    "noResults": "未找到结果",
    "searching": "搜索中..."
```

- [ ] **Step 2: 添加英文翻译**

在 `en.json` 的 `"editor"` 对象内，在 `"openFileToEdit"` 之后添加：

```json
    "search": "Search",
    "searchPlaceholder": "Search file contents...",
    "searchFiles": "Search Files",
    "searchCode": "Search Code",
    "caseSensitive": "Case Sensitive",
    "useRegex": "Regex",
    "searchResults": "{count} results in {files} files",
    "tooManyResults": "Too many results, narrow your search",
    "noResults": "No results found",
    "searching": "Searching..."
```

- [ ] **Step 3: 提交**

```bash
git add packages/web/src/locales/zh.json packages/web/src/locales/en.json
git commit -m "feat(i18n): add search-related translations for editor panel"
```

---

### Task 5: Editor Store 扩展

**Files:**
- Modify: `packages/web/src/stores/editor.ts`

- [ ] **Step 1: 新增 jumpToPosition 和 pendingJump 状态**

完整替换 `packages/web/src/stores/editor.ts`：

```ts
import { create } from 'zustand';
import type { FileNode } from '@agent-spaces/shared';

interface OpenFile {
  path: string;
  name: string;
  content: string;
  modified: boolean;
}

interface JumpPosition {
  line: number;
  column?: number;
}

interface EditorState {
  tree: FileNode[];
  treeLoading: boolean;
  openFiles: OpenFile[];
  activeFilePath: string | null;
  pendingJump: JumpPosition | null;

  loadTree: (workspaceId: string) => Promise<void>;
  openFile: (workspaceId: string, path: string) => Promise<void>;
  saveFile: (workspaceId: string, path: string) => Promise<void>;
  updateContent: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  jumpToPosition: (workspaceId: string, path: string, line: number, column?: number) => Promise<void>;
  clearPendingJump: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tree: [],
  treeLoading: false,
  openFiles: [],
  activeFilePath: null,
  pendingJump: null,

  loadTree: async (workspaceId) => {
    set({ treeLoading: true });
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files/tree`);
      const tree = await res.json();
      set({ tree, treeLoading: false });
    } catch {
      set({ treeLoading: false });
    }
  },

  openFile: async (workspaceId, path) => {
    const existing = get().openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }

    const res = await fetch(
      `/api/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(path)}`
    );
    const data = await res.json();
    const name = path.split('/').pop() || path;

    set((s) => ({
      openFiles: [...s.openFiles, { path, name, content: data.content, modified: false }],
      activeFilePath: path,
    }));
  },

  saveFile: async (workspaceId, path) => {
    const file = get().openFiles.find((f) => f.path === path);
    if (!file) return;

    await fetch(`/api/workspaces/${workspaceId}/files/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: file.content }),
    });

    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, modified: false } : f
      ),
    }));
  },

  updateContent: (path, content) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, content, modified: true } : f
      ),
    }));
  },

  closeFile: (path) => {
    set((s) => {
      const files = s.openFiles.filter((f) => f.path !== path);
      const active =
        s.activeFilePath === path
          ? files.length > 0
            ? files[files.length - 1].path
            : null
          : s.activeFilePath;
      return { openFiles: files, activeFilePath: active };
    });
  },

  setActiveFile: (path) => set({ activeFilePath: path }),

  jumpToPosition: async (workspaceId, path, line, column) => {
    await get().openFile(workspaceId, path);
    set({ pendingJump: { line, column } });
  },

  clearPendingJump: () => set({ pendingJump: null }),
}));
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/stores/editor.ts
git commit -m "feat(web): add jumpToPosition and pendingJump to editor store"
```

---

### Task 6: 搜索面板组件

**Files:**
- Create: `packages/web/src/components/editor/search-panel.tsx`

- [ ] **Step 1: 实现搜索面板**

```tsx
// packages/web/src/components/editor/search-panel.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, CaseSensitive, Regex, FolderSearch, ChevronRight, ChevronDown, File, Loader2 } from "lucide-react";
import { useEditorStore } from "@/stores/editor";
import { useTranslations } from "next-intl";
import type { CodeSearchResult, FileSearchResult } from "@agent-spaces/shared";
import { cn } from "@/lib/utils";

interface SearchPanelProps {
  workspaceId: string;
}

interface GroupedResults {
  [file: string]: CodeSearchResult[];
}

export function SearchPanel({ workspaceId }: SearchPanelProps) {
  const t = useTranslations('editor');
  const { jumpToPosition } = useEditorStore();
  const [query, setQuery] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isFileMode, setIsFileMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeResults, setCodeResults] = useState<GroupedResults>({});
  const [codeTotal, setCodeTotal] = useState(0);
  const [fileResults, setFileResults] = useState<FileSearchResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCodeResults({});
      setCodeTotal(0);
      setFileResults([]);
      return;
    }

    setLoading(true);
    try {
      if (isFileMode) {
        const res = await fetch(`/api/workspaces/${workspaceId}/search/files?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setFileResults(data.results || []);
        setCodeResults({});
        setCodeTotal(0);
      } else {
        const params = new URLSearchParams({
          q,
          regex: String(isRegex),
          caseSensitive: String(isCaseSensitive),
        });
        const res = await fetch(`/api/workspaces/${workspaceId}/search/code?${params}`);
        const data = await res.json();
        const results: CodeSearchResult[] = data.results || [];

        const grouped: GroupedResults = {};
        for (const r of results) {
          if (!grouped[r.file]) grouped[r.file] = [];
          grouped[r.file].push(r);
        }

        setCodeResults(grouped);
        setCodeTotal(results.length);
        setFileResults([]);
        setExpandedFiles(new Set(Object.keys(grouped)));
      }
    } catch {
      setCodeResults({});
      setCodeTotal(0);
      setFileResults([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isRegex, isCaseSensitive, isFileMode]);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  // 模式切换时重新搜索
  useEffect(() => {
    if (query.trim()) doSearch(query);
  }, [isRegex, isCaseSensitive, isFileMode]);

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const handleResultClick = (file: string, line: number, column?: number) => {
    jumpToPosition(workspaceId, file, line, column);
  };

  const handleFileClick = (path: string) => {
    jumpToPosition(workspaceId, path, 1);
  };

  const fileCount = Object.keys(codeResults).length;

  return (
    <div className="flex flex-col h-full">
      {/* 搜索输入 */}
      <div className="px-2 py-1.5 border-b space-y-1">
        <div className="flex items-center gap-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={isFileMode ? t('searchPlaceholder').replace('内容', '名') : t('searchPlaceholder')}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            spellCheck={false}
          />
          {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsCaseSensitive(!isCaseSensitive)}
            className={cn("p-1 rounded text-xs", isCaseSensitive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
            title={t('caseSensitive')}
          >
            <CaseSensitive className="size-3" />
          </button>
          <button
            onClick={() => setIsRegex(!isRegex)}
            className={cn("p-1 rounded text-xs", isRegex ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
            title={t('useRegex')}
          >
            <Regex className="size-3" />
          </button>
          <button
            onClick={() => setIsFileMode(!isFileMode)}
            className={cn("p-1 rounded text-xs", isFileMode ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
            title={t('searchFiles')}
          >
            <FolderSearch className="size-3" />
          </button>
        </div>
      </div>

      {/* 结果统计 */}
      {!loading && query.trim() && (codeTotal > 0 || fileResults.length > 0) && (
        <div className="px-2 py-1 text-[10px] text-muted-foreground border-b">
          {isFileMode
            ? `${fileResults.length} 个文件`
            : t('searchResults').replace('{count}', String(codeTotal)).replace('{files}', String(fileCount))
          }
        </div>
      )}

      {/* 结果列表 */}
      <div className="flex-1 overflow-auto">
        {isFileMode ? (
          // 文件名搜索结果
          <div className="py-1">
            {fileResults.map((f) => (
              <button
                key={f.path}
                onClick={() => handleFileClick(f.path)}
                className="w-full flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-accent/50 text-left"
              >
                <File className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">{f.path}</span>
              </button>
            ))}
          </div>
        ) : (
          // 代码搜索结果
          <div className="py-1">
            {Object.entries(codeResults).map(([file, matches]) => (
              <div key={file}>
                <button
                  onClick={() => toggleFile(file)}
                  className="w-full flex items-center gap-1 px-2 py-0.5 text-xs font-medium hover:bg-accent/50"
                >
                  {expandedFiles.has(file) ? (
                    <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                  )}
                  <File className="size-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{file}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">({matches.length})</span>
                </button>

                {expandedFiles.has(file) && matches.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => handleResultClick(m.file, m.line, m.column)}
                    className="w-full flex items-start gap-2 pl-6 pr-2 py-0.5 text-xs hover:bg-accent/50 text-left font-mono"
                  >
                    <span className="text-muted-foreground w-8 text-right shrink-0">{m.line}</span>
                    <span className="truncate">
                      <HighlightMatch text={m.text} start={m.matchStart} length={m.matchLength} />
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!loading && query.trim() && codeTotal === 0 && fileResults.length === 0 && (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">{t('noResults')}</div>
        )}
        {!loading && codeTotal >= 200 && (
          <div className="px-2 py-2 text-xs text-muted-foreground text-center">{t('tooManyResults')}</div>
        )}
      </div>
    </div>
  );
}

function HighlightMatch({ text, start, length }: { text: string; start: number; length: number }) {
  if (start < 0 || length <= 0 || start >= text.length) return <span>{text}</span>;
  const before = text.slice(0, start);
  const match = text.slice(start, start + length);
  const after = text.slice(start + length);
  return (
    <span>
      {before}
      <span className="bg-yellow-200/60 dark:bg-yellow-800/40 rounded-sm px-px">{match}</span>
      {after}
    </span>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/editor/search-panel.tsx
git commit -m "feat(web): add search panel component with code and file search"
```

---

### Task 7: 编辑器面板 Tab 切换

**Files:**
- Modify: `packages/web/src/components/editor/editor-panel.tsx`

- [ ] **Step 1: 重写 editor-panel.tsx，添加 Tab 切换**

完整替换文件：

```tsx
"use client";

import { useEffect, useState } from "react";
import { FileTree, FileTreeFolder, FileTreeFile } from "./file-tree";
import { SearchPanel } from "./search-panel";
import { useEditorStore } from "@/stores/editor";
import type { FileNode } from "@agent-spaces/shared";
import { RefreshCw } from "lucide-react";
import { FileIconImg, FolderIconImg } from "./file-icon";
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function FileTreeNodes({ nodes }: { nodes: FileNode[] }) {
  return nodes.map((node) =>
    node.type === "directory" ? (
      <FileTreeFolder key={node.path} path={node.path} name={node.name} folderIcon={(isOpen) => <FolderIconImg name={node.name} isOpen={isOpen} />}>
        {node.children && <FileTreeNodes nodes={node.children} />}
      </FileTreeFolder>
    ) : (
      <FileTreeFile key={node.path} path={node.path} name={node.name} icon={<FileIconImg name={node.name} />} />
    ),
  );
}

interface EditorPanelProps {
  workspaceId: string;
}

export function EditorPanel({ workspaceId }: EditorPanelProps) {
  const { tree, treeLoading, loadTree, openFile } = useEditorStore();
  const t = useTranslations('editor');
  const [selectedPath, setSelectedPath] = useState<string>();

  useEffect(() => {
    loadTree(workspaceId);
  }, [workspaceId, loadTree]);

  const handleDelete = async (path: string) => {
    await fetch(`/api/workspaces/${workspaceId}/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    loadTree(workspaceId);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="files" className="flex flex-col h-full">
        <TabsList className="w-full rounded-none border-b bg-transparent h-8 p-0 shrink-0">
          <TabsTrigger value="files" className="flex-1 gap-1 text-xs data-[active]:shadow-none data-[active]:border-b-2 data-[active]:border-primary rounded-none">
            {t('explorer')}
          </TabsTrigger>
          <TabsTrigger value="search" className="flex-1 gap-1 text-xs data-[active]:shadow-none data-[active]:border-b-2 data-[active]:border-primary rounded-none">
            {t('search')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="flex-1 min-h-0 mt-0">
          <div className="flex items-center justify-end px-2 py-1 border-b">
            <button
              onClick={() => loadTree(workspaceId)}
              className="p-0.5 hover:bg-accent rounded"
              disabled={treeLoading}
            >
              <RefreshCw className={`size-3 ${treeLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="overflow-auto py-1" style={{ height: 'calc(100% - 28px)' }}>
            {tree.length === 0 && !treeLoading && (
              <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                {t('noFiles')}
              </div>
            )}
            {tree.length > 0 && (
              <FileTree
                selectedPath={selectedPath}
                onFileSelect={(path) => {
                  setSelectedPath(path);
                  openFile(workspaceId, path);
                }}
                workspaceId={workspaceId}
                onDelete={handleDelete}
              >
                <FileTreeNodes nodes={tree} />
              </FileTree>
            )}
          </div>
        </TabsContent>

        <TabsContent value="search" className="flex-1 min-h-0 mt-0">
          <SearchPanel workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/editor/editor-panel.tsx
git commit -m "feat(web): add tab switching between file explorer and search panel"
```

---

### Task 8: Monaco Model 管理器

**Files:**
- Create: `packages/web/src/lib/monaco-models.ts`

- [ ] **Step 1: 实现 Monaco Model 管理器**

```ts
// packages/web/src/lib/monaco-models.ts
import * as monaco from 'monaco-editor';

const PRELOAD_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const MAX_PRELOAD_FILES = 20;
const MAX_PRELOAD_SIZE = 500 * 1024; // 500KB

const modelCache = new Map<string, monaco.editor.ITextModel>();
const preloadedDirs = new Set<string>();

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown',
    css: 'css', html: 'html',
    yaml: 'yaml', yml: 'yaml',
    py: 'python', rs: 'rust', go: 'go',
    sql: 'sql', sh: 'shell', bash: 'shell',
  };
  return map[ext] || 'plaintext';
}

function toUri(workspaceId: string, filePath: string): monaco.Uri {
  return monaco.Uri.parse(`file:///workspace/${workspaceId}/${filePath}`);
}

export function getOrCreateModel(
  workspaceId: string,
  filePath: string,
  content: string,
): monaco.editor.ITextModel {
  const uri = toUri(workspaceId, filePath);
  let model = monaco.editor.getModel(uri);

  if (!model) {
    model = monaco.editor.createModel(content, getLanguageFromPath(filePath), uri);
  } else {
    // 只在内容不同时更新，避免撤销栈被清空
    if (model.getValue() !== content) {
      model.setValue(content);
    }
  }

  modelCache.set(filePath, model);
  return model;
}

export function getModel(workspaceId: string, filePath: string): monaco.editor.ITextModel | null {
  const uri = toUri(workspaceId, filePath);
  return monaco.editor.getModel(uri);
}

export function getModelUri(workspaceId: string, filePath: string): monaco.Uri {
  return toUri(workspaceId, filePath);
}

export async function preloadDirectory(
  workspaceId: string,
  filePath: string,
): Promise<void> {
  const dir = filePath.split('/').slice(0, -1).join('/');
  const cacheKey = `${workspaceId}:${dir}`;

  if (preloadedDirs.has(cacheKey)) return;
  preloadedDirs.add(cacheKey);

  try {
    const params = new URLSearchParams({ path: dir });
    const res = await fetch(`/api/workspaces/${workspaceId}/files/tree?${params}`);
    const nodes: Array<{ name: string; path: string; type: string; size?: number }> = await res.json();

    let count = 0;
    for (const node of nodes) {
      if (count >= MAX_PRELOAD_FILES) break;
      if (node.type !== 'file') continue;

      const ext = '.' + (node.name.split('.').pop()?.toLowerCase() || '');
      if (!PRELOAD_EXTENSIONS.includes(ext)) continue;
      if (node.size && node.size > MAX_PRELOAD_SIZE) continue;

      // 跳过已经有 model 的文件
      const uri = toUri(workspaceId, node.path);
      if (monaco.editor.getModel(uri)) continue;

      try {
        const contentRes = await fetch(
          `/api/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(node.path)}`
        );
        const data = await contentRes.json();
        if (data.content !== undefined) {
          getOrCreateModel(workspaceId, node.path, data.content);
          count++;
        }
      } catch { /* skip */ }
    }
  } catch { /* dir preload failed, non-critical */ }
}

export function disposeModel(filePath: string): void {
  const model = modelCache.get(filePath);
  if (model) {
    model.dispose();
    modelCache.delete(filePath);
  }
}

export function disposeAll(): void {
  for (const model of modelCache.values()) {
    model.dispose();
  }
  modelCache.clear();
  preloadedDirs.clear();
}

export function setupLanguageDefaults(): void {
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // 禁用 tsconfig 校验，避免跨文件报错干扰
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/lib/monaco-models.ts
git commit -m "feat(web): add Monaco model manager with directory preloading"
```

---

### Task 9: 集成 Monaco Model 管理器 + 跳转到 CodeEditor

**Files:**
- Modify: `packages/web/src/components/editor/code-editor.tsx`

- [ ] **Step 1: 集成 Model 管理器和跳转**

完整替换 `packages/web/src/components/editor/code-editor.tsx`：

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback } from "react";
import "@/lib/monaco-loader";
import { useEditorStore } from "@/stores/editor";
import { EditorTabs } from "./editor-tabs";
import { useTheme } from "@/components/theme-provider";
import { useTranslations } from 'next-intl';
import {
  getOrCreateModel,
  getModelUri,
  preloadDirectory,
  setupLanguageDefaults,
  disposeAll,
} from "@/lib/monaco-models";
import type * as Monaco from 'monaco-editor';

if (typeof window !== "undefined" && !navigator.clipboard?.write) {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      ...navigator.clipboard,
      writeText: navigator.clipboard?.writeText ?? ((text: string) => Promise.resolve()),
      write: (items: ClipboardItem[]) => {
        const textItem = items[0]?.getType("text/plain");
        return textItem
          ? textItem.then((blob) => blob.text()).then((text) => navigator.clipboard.writeText(text))
          : Promise.resolve();
      },
    },
    writable: true,
    configurable: true,
  });
}

function EditorLoadingFallback() {
  const t = useTranslations('editor');
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('loadingEditor')}</div>;
}

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false, loading: () => <EditorLoadingFallback /> }
);

interface CodeEditorProps {
  workspaceId: string;
}

export function CodeEditor({ workspaceId }: CodeEditorProps) {
  const { openFiles, activeFilePath, updateContent, saveFile, pendingJump, clearPendingJump } = useEditorStore();
  const { resolvedTheme } = useTheme();
  const t = useTranslations('editor');
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  const handleSave = useCallback(() => {
    if (activeFilePath) {
      saveFile(workspaceId, activeFilePath);
    }
  }, [activeFilePath, saveFile, workspaceId]);

  // Monaco 配置 + Model 注册
  const handleMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof Monaco) => {
    editorRef.current = editor;
    setupLanguageDefaults();

    editor.addCommand(
      2048 | 49, // KeyMod.CtrlCmd | KeyCode.KeyS
      () => handleSave()
    );
  }, [handleSave]);

  // 当前文件变化时注册 Model + 预加载目录
  useEffect(() => {
    if (!activeFile || !activeFilePath) return;

    getOrCreateModel(workspaceId, activeFilePath, activeFile.content);
    preloadDirectory(workspaceId, activeFilePath);
  }, [activeFilePath, workspaceId, activeFile]);

  // pendingJump 跳转
  useEffect(() => {
    if (!pendingJump || !editorRef.current) return;

    const { line, column } = pendingJump;
    const editor = editorRef.current;

    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: column || 1 });
    editor.focus();
    clearPendingJump();
  }, [pendingJump, clearPendingJump]);

  // 获取当前文件的 model URI path（给 @monaco-editor/react 的 path prop）
  const modelPath = activeFilePath
    ? `/${workspaceId}/${activeFilePath}`
    : undefined;

  return (
    <div className="flex flex-col h-full">
      <EditorTabs workspaceId={workspaceId} />
      <div className="flex-1 min-h-0">
        {activeFile ? (
          <MonacoEditor
            height="100%"
            language={getLanguage(activeFile.path)}
            value={activeFile.content}
            path={modelPath}
            onChange={(value) => updateContent(activeFile.path, value || "")}
            onMount={handleMount}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              renderLineHighlight: "gutter",
            }}
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('openFileToEdit')}
          </div>
        )}
      </div>
    </div>
  );
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    rs: "rust",
    go: "go",
    sql: "sql",
    sh: "shell",
    bash: "shell",
  };
  return map[ext || ""] || "plaintext";
}
```

- [ ] **Step 2: 构建验证**

Run: `cd packages/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add packages/web/src/components/editor/code-editor.tsx
git commit -m "feat(web): integrate Monaco model manager with code editor for cross-file navigation"
```

---

### Task 10: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`

- [ ] **Step 2: 验证搜索功能**

1. 打开浏览器访问 http://localhost:3000
2. 进入工作空间页面
3. 在左侧编辑器面板看到 `[资源管理器] [搜索]` 两个 Tab
4. 切换到搜索 Tab
5. 输入搜索关键词，确认结果列表显示
6. 点击结果，确认文件打开并跳转到对应行
7. 测试文件名搜索模式（点击文件夹图标按钮）
8. 测试大小写敏感和正则模式切换

- [ ] **Step 3: 验证 Monaco 跨文件跳转**

1. 打开一个 `.ts` 文件
2. Ctrl+Click 一个函数调用，确认能跳转到定义
3. 右键选择 "Go to References"，确认跨文件 References 列表正常
4. 确认同目录下的 `.ts` 文件已被预加载为 Monaco Model

- [ ] **Step 4: 提交所有变更**

```bash
git add -A
git commit -m "feat: editor search and Monaco multi-model support complete"
```
