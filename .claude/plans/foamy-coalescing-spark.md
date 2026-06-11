# 修复 workflow-ui-editor 的 FileTree 菜单失效

## Context

`packages/web/src/components/workflows-ui/workflow-ui-editor.tsx:428-443` 里的 `FileTree`（Popover 形式的文件树）所有菜单操作点击无反应。

**根因**：`FileTree` 组件（`packages/web/src/components/editor/file-tree.tsx`）内部，文件夹/文件的 hover 按钮、右键菜单（`ContextMenu`）全部依赖 `FileTreeContext` 注入的回调（`onDelete`/`onRename`/`onMove`/`onCreateFile`/`onCreateFolder`/`onCopyItem`/`workspaceId` 等）。`workflow-ui-editor.tsx` 只传了 `defaultExpanded`/`selectedPath`/`onFileSelect` 三个 prop，其余全是 `undefined`，所以 `onRename?.()` 这类调用直接跳过，点了没反应。文件项的 `FileContextMenu` 还用 `workspaceId={workspaceId!}` 做了非空断言（实际是 `undefined`）。

**为什么不能"走一套公用逻辑"**：通用 editor（`editor-panel.tsx`，原生使用方）的文件存在 workspace 本地磁盘，走 `sdk.editor.*`（reveal/copy/delete/rename 全套，依赖 `workspaceId`）。workflow-ui 的文件存在 `~/.agent-spaces-data/workflows-ui/<id>/src/`，走 `sdk.workflowUi.*`，目前只有 read/write/tree/upload，**没有 delete/rename/move/createFolder**。标识符也不同（`projectId` vs `workspaceId`）。所以菜单要可用，必须给 workflow-ui 补后端接口 + sdk 方法 + 前端回调，无法直接复用 editor 那套。

**reveal/terminal/download**：这些依赖本地文件系统路径（打开 Finder/终端、workspace download 接口），workflow-ui 文件在 server 端虚拟项目目录里，前端无本地路径 → **这些项在 workflow-ui 场景无意义，应隐藏**。

## 目标

让 workflow-ui FileTree 的文件管理菜单（删除/重命名/移动/新建文件/新建文件夹/复制）可用；隐藏不适用的本地系统项（reveal/terminal/download/copyDownloadUrl）。不动通用 editor 的现有行为。

## 改动方案

### 1. store 层 — 加 4 个 fs 操作
`packages/server/src/storage/workflow-ui-store.ts`

复用现有 `safeSrcPath`（已防路径越界）和 `touchProject`。新增：
- `deleteFile(projectId, filePath)` — `rmSync(safeSrcPath(...))`，文件用 `force`，目录用 `recursive`
- `renameFile(projectId, oldPath, newPath)` — `renameSync(safeSrcPath(old), safeSrcPath(new))`（先 `ensureDir(dirname(new))`）。目录也可用同一方法（rename 对目录递归生效）
- `createFolder(projectId, dirPath)` — `ensureDir(safeSrcPath(dirPath))`

注：`move` 和 `rename` 本质都是改路径，合并为 `renameFile` 一个方法。

### 2. service 层 — 透传
`packages/server/src/services/workflow-ui.ts`

新增同名的 `deleteFile`/`renameFile`/`createFolder`，直接调 store。

### 3. route 层 — 加 3 个端点
`packages/server/src/routes/workflow-ui.ts`

- `DELETE /:id/files` — body/query: `path` → `svc.deleteFile`
- `POST /:id/files/rename` — body: `{ from, to }` → `svc.renameFile`
- `POST /:id/files/folder` — body: `{ path }` → `svc.createFolder`

沿用现有 route 的 try/catch + 错误码风格。新建空文件复用已有 `PUT /:id/files/content`（content 传 `''`）即可，不新增端点。

### 4. sdk 层 — 加 3 个方法
`packages/sdk/src/modules/workflow-ui.ts`

```ts
deleteFile: (id, filePath) => http.delete(`/api/workflows-ui/${id}/files`, { path: filePath }),
renameFile: (id, from, to) => http.post(`/api/workflows-ui/${id}/files/rename`, { from, to }),
createFolder: (id, dirPath) => http.postVoid(`/api/workflows-ui/${id}/files/folder`, { path: dirPath }),
```
（按 `HttpClient` 现有方法签名调整，确认 delete 是否需要 `deleteOf`。）

### 5. FileTree 组件 — 加 prop 控制菜单项可见性
`packages/web/src/components/editor/file-tree.tsx`

问题：reveal/terminal/duplicate(文件项)/download 等是**组件内部硬编码**的（`FileTreeFolder` 第 296 行 `handleReveal`、第 300 行 terminal；`FileContextMenu` 整个组件依赖 `workspaceId`）。要让 workflow-ui 隐藏这些，需给组件加开关。

方案：`FileTreeProps` 加 `variant?: 'workspace' | 'project'`（默认 `'workspace'`，保持 `editor-panel.tsx` 行为不变）。通过 context 传下去，`FileTreeFolder`/`FileTreeFile` 内部据此条件渲染对应的 `ContextMenuItem`/hover 按钮。
- `variant === 'project'` 时隐藏：reveal、openInTerminal、download、copyDownloadUrl、duplicate（duplicate 依赖 `sdk.editor.copy`，workflow-ui 无对应接口）。
- `FileContextMenu` 的 `workspaceId` 改为可选；当 `workspaceId` 缺失时不渲染依赖它的项（`handleReveal`/`handleDownload`/`handleCopyDownloadUrl`/duplicate）。

这保证 `editor-panel.tsx`（传 `workspaceId`、不传 variant）行为完全不变。

### 6. workflow-ui-editor.tsx — 接通回调 + 传 variant
`packages/web/src/components/workflows-ui/workflow-ui-editor.tsx`

在 `FileTree` 上补：
```tsx
<FileTree
  variant="project"
  defaultExpanded={...}
  selectedPath={activeFile}
  onFileSelect={(path) => handleFileSelect(path)}
  onDelete={handleDeleteFile}
  onRename={handleRenameFile}
  onMove={handleMoveFile}
  onCopyItem={handleCopyFile}
  onCreateFile={(dir) => handleCreateFile(dir)}
  onCreateFolder={(dir) => handleCreateFolder(dir)}
>
  {renderTreeNodes(buildFileTree(files))}
</FileTree>
```

新增这些 handler（参考 `editor-panel.tsx` 的 `handleDelete`/`openNameDialog`/`handleRename`/`handleMove`/`handleCopy` 的交互模式 —— 用 `Dialog` 收集新名字/目标路径），内部调 `sdk.workflowUi.deleteFile/renameFile/...`，成功后调已有的 `refreshFileTree()`（第 197 行）刷新。新建文件/文件夹、重命名、移动用一个通用的"输入文件名" `Dialog` 组件（复用 `editor-panel.tsx` 里 `nameDialog`/`renameDialog`/`moveDialog` 的模式，不必照搬全字段，按需精简）。

复制（`onCopyItem`）：前端用 `readFile` + `writeFile` 到 `原路径 copy` 拼出复制，不走后端。

### 7. i18n
`packages/web/src/locales/{en,zh}/workflows-ui.json` 补新增的 Dialog 文案 key（新建文件/文件夹、重命名、移动、删除确认等）。注意 `FileTree` 内部菜单项用的是 `editor` 命名空间的 key（已存在），不用改；只有 workflow-ui-editor 自己新加的 Dialog 文案需要补 workflows-ui 命名空间。

## 关键文件

| 文件 | 改动 |
|------|------|
| `packages/server/src/storage/workflow-ui-store.ts` | +`deleteFile`/`renameFile`/`createFolder` |
| `packages/server/src/services/workflow-ui.ts` | 透传 3 个方法 |
| `packages/server/src/routes/workflow-ui.ts` | +3 个端点 |
| `packages/sdk/src/modules/workflow-ui.ts` | +3 个方法 |
| `packages/web/src/components/editor/file-tree.tsx` | +`variant` prop，条件渲染菜单项，`FileContextMenu` workspaceId 可选 |
| `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` | 接通 6 个回调 + 输入 Dialog + 传 `variant="project"` |
| `packages/web/src/locales/{en,zh}/workflows-ui.json` | 补 Dialog 文案 |

## 验证

1. `pnpm build`（构建顺序 shared→sdk→server→web，确认类型无误）
2. `pnpm dev` 启动 server(3100)+web(3000)
3. 进入任意 workflow-ui 项目编辑页，打开右上角 FileTree Popover：
   - 点文件夹 → 展开/收起正常
   - 右键文件 → 删除/重命名/移动/复制 菜单出现且可执行，操作后文件树刷新
   - 右键文件夹 → 新建文件/新建文件夹/重命名/删除 可执行
   - reveal/terminal/download/duplicate 项**不出现**
   - 点文件 → 正常加载到 Monaco 编辑器（`handleFileSelect` 不受影响）
4. 回到通用 editor 页面（workspace 编辑器），确认 FileTree 行为与改动前一致（reveal/terminal/download 仍在，菜单全可用）—— 验证 `variant` 默认值没破坏原功能。
