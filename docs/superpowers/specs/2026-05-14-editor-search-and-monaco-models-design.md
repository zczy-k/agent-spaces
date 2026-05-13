# Editor Search & Monaco Multi-Model Design

Date: 2026-05-14

## Overview

为编辑器面板增加代码搜索和文件名搜索功能，并通过 Monaco 多文件模型注册实现跨文件的 Go to Definition / Find References 跳转。

## 后端新增

### 1. 搜索路由 `routes/search.ts`

挂载路径：`app.use('/api/workspaces/:id/search', searchRouter)`

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/code` | `q` (必填), `regex=false`, `caseSensitive=false`, `filePattern=`, `maxResults=200` | 代码内容搜索 |
| GET | `/files` | `q` (必填) | 文件名模糊搜索 |

### 2. 搜索服务 `services/search.ts`

**`searchCode(workspace, options)`**:
- 优先调用 `rg` (ripgrep)，参数：`--json --max-count <maxResults> [--regex] [-i] [--glob <pattern>]`
- 解析 ripgrep JSON 输出为 `CodeSearchResult[]`
- 若 `rg` 不可用（ENOENT / 非 0 exit code），降级到 Node.js 原生实现：
  - 递归遍历 `boundDirs[0]`，跳过 `IGNORED_DIRS`
  - 二进制文件跳过（检测 null byte）
  - 单文件最大 1MB，超出跳过
  - 逐行匹配，支持正则/大小写

**`searchFiles(workspace, query)`**:
- 复用 `readTree` 递归遍历
- 文件名包含 query（大小写不敏感）即返回
- 限制 100 条结果

### 3. Shared 类型 `types/search.ts`

```ts
interface CodeSearchResult {
  file: string;       // 相对路径
  line: number;       // 1-based
  column: number;     // 1-based
  text: string;       // 匹配行内容（trim 后）
  matchStart: number; // 匹配在 text 中的起始位置
  matchLength: number; // 匹配长度
}

interface FileSearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
}
```

## 前端新增

### 4. 编辑器面板 Tab 切换

`editor-panel.tsx` 改为 Tab 式布局：

```
┌──────────────────────────┐
│ [文件] [搜索]             │
│──────────────────────────│
│ 文件Tab: 现有文件树        │
│ 搜索Tab: 搜索面板          │
└──────────────────────────┘
```

- 使用 shadcn `Tabs` 组件
- 文件 Tab 保持现有逻辑不变
- 搜索 Tab 内容见下节

### 5. 搜索面板 `editor/search-panel.tsx`

**UI 结构**：

```
┌──────────────────────────┐
│ 🔍 搜索框                 │
│ [Aa] [.*] [📁] 替换       │
│──────────────────────────│
│ 2 个文件, 5 个结果         │
│──────────────────────────│
│ ▼ src/components/         │
│   📄 button.tsx (3)       │
│     12: function handleClick│
│     45:   await handleClick │
│     89:  const fn = handleClick│
│   📄 form.tsx (1)         │
│     23: import { handleClick}│
└──────────────────────────┘
```

**功能**：
- 搜索框输入防抖 300ms
- 三个开关：大小写敏感、正则模式、文件名搜索模式
- 文件名模式调用 `/search/files`，否则调用 `/search/code`
- 结果按文件分组，显示匹配行号和上下文
- 匹配文本高亮
- 点击结果：调用 `openFile(workspaceId, path)` + 编辑器跳转到对应行
- 超过 200 结果时底部提示 "结果过多，请缩小搜索范围"

### 6. Monaco 多文件模型注册

**改动文件**: `code-editor.tsx` + 新增 `lib/monaco-models.ts`

**`lib/monaco-models.ts`** — Model 管理器：

```ts
// 核心接口
interface MonacoModelManager {
  // 打开文件时调用：注册当前文件 + 预加载同目录相关文件
  openFile(workspaceId: string, filePath: string, content: string): void;

  // 获取 Monaco URI
  getFileUri(filePath: string): Uri;

  // 清理不在 openFiles 中的 model（保留预加载的）
  disposeStale(): void;

  // 销毁所有 model
  disposeAll(): void;
}
```

**策略（智能预加载）**：

1. 打开文件时，创建/更新该文件的 Monaco Model（`monaco.editor.createModel`）
2. 同时异步预加载同目录下的 `.ts/.tsx/.js/.jsx` 文件（最多 20 个，单文件 < 500KB）
3. 已有 Model 不重复创建
4. 预加载的 Model 不在 tab 中显示，仅为语言服务提供上下文

**`code-editor.tsx` 改动**：

- `onMount` 中配置 TypeScript 语言服务：
  ```ts
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  ```
- 打开文件时通过 Model 管理器注册 Model
- 设置 `path` prop 让 `@monaco-editor/react` 使用对应 URI
- 搜索结果跳转时调用 `editor.revealLineInCenter(line)` + `editor.setPosition({ lineNumber, column })`

### 7. Editor Store 扩展

`stores/editor.ts` 新增：

```ts
// 新增方法
jumpToPosition: (path: string, line: number, column?: number) => Promise<void>;
```

- 调用 `openFile` 确保文件已打开
- 存储跳转目标 `{ line, column }`
- `CodeEditor` 组件在 `useEffect` 中检测跳转目标并执行 `editor.revealLineInCenter`

## 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `packages/shared/src/types/search.ts` | 搜索结果类型 |
| 修改 | `packages/shared/src/types/index.ts` | 导出 search 类型 |
| 新增 | `packages/server/src/routes/search.ts` | 搜索路由 |
| 新增 | `packages/server/src/services/search.ts` | 搜索服务（ripgrep + Node.js 降级） |
| 修改 | `packages/server/src/app.ts` | 注册搜索路由 |
| 修改 | `packages/web/src/components/editor/editor-panel.tsx` | Tab 切换 + 搜索面板 |
| 新增 | `packages/web/src/components/editor/search-panel.tsx` | 搜索面板组件 |
| 新增 | `packages/web/src/lib/monaco-models.ts` | Monaco Model 管理器 |
| 修改 | `packages/web/src/components/editor/code-editor.tsx` | 集成 Model 管理器 + 跳转 |
| 修改 | `packages/web/src/stores/editor.ts` | 新增 jumpToPosition |
| 修改 | `packages/web/src/locales/zh.json` | 搜索相关中文翻译 |
| 修改 | `packages/web/src/locales/en.json` | 搜索相关英文翻译 |

## 安全考虑

- 搜索路径复用 `resolvePath()` 防止目录遍历
- 搜索结果数量限制（默认 200，防止大量输出）
- 单文件大小限制（1MB，防止读取大文件阻塞）
- 文件名搜索结果限制 100 条

## 不做的事

- 不做搜索替换（replace all）— 第一版只做搜索和跳转
- 不做搜索历史持久化
- 不做全局搜索（跨 workspace）
- 不做符号搜索（symbol search）— 依赖 Monaco 内置即可
