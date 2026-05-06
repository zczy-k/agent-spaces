# i18n 实施计划 — 第 3 波 Part 2：Issue/Editor/Git/Terminal/Settings/Composer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造 Issue、Editor、Git、Terminal、Project Settings、Composer 功能面板组件的硬编码文本。

**Architecture:** 新增 `issue`、`task`、`editor`、`terminal`、`git`、`projectSettings`、`composer` namespace。Issue 状态标签集中定义避免重复。

**Tech Stack:** next-intl useTranslations

**Spec:** `docs/superpowers/specs/2026-05-06-i18n-design.md`
**Depends on:** `docs/superpowers/plans/2026-05-06-i18n-wave1-infrastructure.md`

---

## Task 1: 改造 Issue 组件（6 个文件）

Issue 组件有大量重复的 status 标签，建议在 en.json/zh.json 的 `issue` namespace 中集中定义状态映射。

### 1a. 改造 issue-list.tsx

**Files:** Modify `packages/web/src/components/issue/issue-list.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `"Draft"` ~ `"Error"` (9 个状态) | `t('status.draft')` ~ `t('status.error')` |
| `"Issues"` | `t('list.title')` |
| `'暂无议题'` | `t('list.emptyTitle')` |
| `'创建一个议题开始协作'` | `t('list.emptyDescription')` |
| `'添加议题'` | `t('list.addIssue')` |
| `task{...s}` (动态复数) | `t('list.taskCount', { count })` |
| `"Edit"` / `"Delete"` | `tc('edit')` / `tc('delete')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/issue/issue-list.tsx
git commit -m "feat(web): i18n issue-list component"
```

### 1b. 改造 issue-detail.tsx

**Files:** Modify `packages/web/src/components/issue/issue-detail.tsx`

**需要替换的文本（约 50 处）：**

主要分类：
- **Issue 状态** (9 个): Draft ~ Error → `issue.status.*`
- **Task 状态** (8 个): Pending, Running, Reviewing, etc. → `task.status.*`
- **评论输入**: `Write a comment... 支持 @mention` → `issue.detail.commentPlaceholder`
- **空状态**: `Select an issue to view details` → `issue.detail.selectIssue`
- **按钮/标签**: 打开聊天频道、Start、Resume failed tasks、Add Task、No tasks yet → `issue.detail.*`
- **Info 标签**: 状态、Issue ID、任务数、成员数、创建时间、更新时间、分支、PR、描述 → `issue.detail.info*`
- **Tab 标签**: 信息、成员 → `issue.detail.tab*`
- **成员**: `{n} member{s}` → `issue.detail.memberCount`
- **按钮**: 评论、添加成员、删除 Issue → `issue.detail.*`
- **日期标签**: Created, Updated → `issue.detail.created` / `issue.detail.updated`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/issue/issue-detail.tsx
git commit -m "feat(web): i18n issue-detail component"
```

### 1c. 改造 issue-message.tsx

**Files:** Modify `packages/web/src/components/issue/issue-message.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `"You"` | `tc('you')` |
| `'task {taskId}'` | `t('message.task', { taskId })` |
| `"Open message"` | `t('message.openMessage')` |
| `'展开更多'` | `t('message.expandMore')` |
| `'收起'` | `t('message.collapse')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/issue/issue-message.tsx
git commit -m "feat(web): i18n issue-message component"
```

### 1d. 改造 edit-issue-dialog.tsx

**Files:** Modify `packages/web/src/components/issue/edit-issue-dialog.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'编辑议题'` | `t('edit.title')` |
| `'修改议题信息、状态和成员'` | `t('edit.description')` |
| `'Title'` | `t('edit.titlePlaceholder')` |
| `'Description'` | `t('edit.descriptionPlaceholder')` |
| `'Status'` | `t('edit.statusLabel')` |
| `'成员'` | `t('edit.membersLabel')` |
| `'搜索 Agent...'` | `t('edit.searchAgent')` |
| `'无可用 Agent'` | `t('edit.noAgents')` |
| `"User"` | `tc('user')` |
| 状态选项 (9 个) | `t('status.*')` (复用集中定义) |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/issue/edit-issue-dialog.tsx
git commit -m "feat(web): i18n edit-issue-dialog component"
```

### 1e. 改造 create-issue-dialog.tsx

**Files:** Modify `packages/web/src/components/issue/create-issue-dialog.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'创建议题'` | `t('create.title')` |
| `'创建一个新的议题并指定成员'` | `t('create.description')` |
| `'标题'` | `t('create.titlePlaceholder')` |
| `'描述（可选）'` | `t('create.descriptionPlaceholder')` |
| `'成员'` | `t('create.membersLabel')` |
| `'搜索 Agent...'` | `t('create.searchAgent')` |
| `'无可用 Agent'` | `t('create.noAgents')` |
| `"User"` | `tc('user')` |
| `'取消'` | `tc('cancel')` |
| `'创建'` | `t('create.submit')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/issue/create-issue-dialog.tsx
git commit -m "feat(web): i18n create-issue-dialog component"
```

### 1f. 改造 comment-navigator.tsx

**Files:** Modify `packages/web/src/components/issue/comment-navigator.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `"You"` | `tc('you')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/issue/comment-navigator.tsx
git commit -m "feat(web): i18n comment-navigator component"
```

---

## Task 2: 改造 Editor 组件（3 个文件）

### 2a. 改造 editor-panel.tsx

**Files:** Modify `packages/web/src/components/editor/editor-panel.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'EXPLORER'` | `t('editor.explorer')` |
| `'No files found'` | `t('editor.noFiles')` |

### 2b. 改造 file-tree.tsx

**Files:** Modify `packages/web/src/components/editor/file-tree.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'Reveal in Finder'` (×2) | `t('editor.revealInFinder')` |
| `'Delete'` (×2) | `tc('delete')` |

### 2c. 改造 code-editor.tsx

**Files:** Modify `packages/web/src/components/editor/code-editor.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'Loading editor...'` | `t('editor.loadingEditor')` |
| `'Open a file to start editing'` | `t('editor.openFileToEdit')` |

注意：`editor-tabs.tsx` 无硬编码文本，无需改造。

- [ ] **Step: 3 个文件一起改造，验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/editor/
git commit -m "feat(web): i18n editor components (editor-panel, file-tree, code-editor)"
```

---

## Task 3: 改造 Git 组件（6 个文件）

注意：`git-panel.tsx` 不存在，跳过。

### 3a. 改造 git-changes-panel.tsx

**Files:** Modify `packages/web/src/components/git/git-changes-panel.tsx`

**需要替换的文本（约 25 处）：**

主要分类：
- **面板标题**: Changes → `git.changes.title`
- **Toast 消息**: Synced successfully, Sync failed, Failed to generate commit message → `git.syncedSuccessfully` 等
- **操作按钮**: Commit, Sync Changes, Discard all changes, Refresh, Edit .gitignore → `git.*`
- **空状态**: No changes, No branches → `git.noChanges` 等
- **上下文菜单**: 忽略此文件、忽略文件路径 → `git.ignoreThisFile` 等
- **占位符**: Commit message (⌘+Enter) → `git.commitMessagePlaceholder`
- **diff 区域**: Select a file to view diff, No changes to show → `git.selectFileDiff` 等

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/git/git-changes-panel.tsx
git commit -m "feat(web): i18n git-changes-panel component"
```

### 3b. 改造 git-commits-panel.tsx

**Files:** Modify `packages/web/src/components/git/git-commits-panel.tsx`

**需要替换的文本（约 15 处）：**

主要分类：
- **面板标题**: Commits, Commits ({n}) → `git.commits.title` / `git.commits.titleWithCount`
- **操作按钮**: Push {n} commits, Pull {n} commits, Refresh → `git.pushNCommits` 等
- **Toast 消息**: Pushed/Pulled successfully, Push/Pull failed, Remote added → `git.*`
- **空状态**: No commits → `git.noCommits`
- **标签**: Remote tracking branch → `git.remoteTrackingBranch`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/git/git-commits-panel.tsx
git commit -m "feat(web): i18n git-commits-panel component"
```

### 3c. 改造 git-graph-panel.tsx

**Files:** Modify `packages/web/src/components/git/git-graph-panel.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'Graph'` | `t('git.graph.title')` |
| `'Refresh'` | `tc('refresh')` |
| `'No commits'` | `t('git.noCommits')` |
| `'just now'` | `t('time.justNow')` |
| `'{n}m ago'` | `t('time.minutesAgo', { n })` |
| `'{n}h ago'` | `t('time.hoursAgo', { n })` |
| `'{n}d ago'` | `t('time.daysAgo', { n })` |

### 3d. 改造 git-remote-dialog.tsx

**Files:** Modify `packages/web/src/components/git/git-remote-dialog.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'Bind Remote Repository'` | `t('git.remote.bindTitle')` |
| `'Remote name'` | `t('git.remote.nameLabel')` |
| `'origin'` | `t('git.remote.namePlaceholder')` |
| `'Remote URL'` | `t('git.remote.urlLabel')` |
| `'https://github.com/user/repo.git'` | `t('git.remote.urlPlaceholder')` |
| `'Cancel'` | `tc('cancel')` |
| `'Adding...'` | `t('git.remote.adding')` |
| `'Add Remote'` | `t('git.remote.addRemote')` |

### 3e. 改造 git-not-initialized.tsx

**Files:** Modify `packages/web/src/components/git/git-not-initialized.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'Not a Git repository'` | `t('git.notInitialized.message')` |
| `'Initializing...'` | `t('git.notInitialized.initializing')` |
| `'Initialize Git Repository'` | `t('git.notInitialized.initialize')` |

- [ ] **Step: 3c-3e 一起改造，验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/git/
git commit -m "feat(web): i18n git components (graph, remote, not-initialized)"
```

---

## Task 4: 改造 Terminal 组件（1 个文件）

**Files:** Modify `packages/web/src/components/terminal/terminal-panel.tsx`

注意：`terminal-instance.tsx` 无硬编码文本，无需改造。

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'zsh'`, `'bash'`, `'CMD'`, `'PowerShell'` | Shell 选项标签不翻译（技术术语） |
| `'New Terminal'` | `t('terminal.newTerminal')` |
| `'No terminal session'` | `t('terminal.noSession')` |
| `'Select Working Directory'` | `t('terminal.selectWorkingDirectory')` |
| `'This workspace has multiple bound directories...'` | `t('terminal.selectWorkingDirectoryDescription')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/terminal/terminal-panel.tsx
git commit -m "feat(web): i18n terminal-panel component"
```

---

## Task 5: 改造 Project Settings 面板

**Files:** Modify `packages/web/src/components/settings/project-settings-panel.tsx`

**需要替换的文本（约 60 处）：**

这是文本量第二大的文件，主要分类：

- **页面标题/章节**: Project Settings, Info, Automation, Notifications, Prompt → `projectSettings.section.*`
- **信息标签**: Path, Channels, Issues → `projectSettings.info.*`
- **自动化**: Auto Process Issues 开关及描述 → `projectSettings.automation.*`
- **通知设置**: 消息通知开关、飞书/企微 Tab、App ID/Secret 表单、启停按钮 → `projectSettings.notifications.*`
- **企微 QR**: Connected/Scanned/Expired/Scan QR 状态、Refresh Login/Get QR 按钮 → `projectSettings.wechat.*`
- **Bot Agent**: 选中状态、Manage 按钮 → `projectSettings.botAgent.*`
- **通知事件**: 议题开始/结束/任务完成 → `projectSettings.event.*`
- **Prompt**: Workspace Prompt 标签和描述 → `projectSettings.prompt.*`
- **Toast 消息**: 保存成功/失败、启停成功/失败 → `projectSettings.toast.*`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/settings/project-settings-panel.tsx
git commit -m "feat(web): i18n project-settings-panel component"
```

---

## Task 6: 改造 Composer 组件（1 个文件）

**Files:** Modify `packages/web/src/components/composer/composer-dialog.tsx`

注意：`composer-shell.tsx` 无硬编码文本，无需改造。

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `'打开对话框'` | `t('composer.openDialog')` |
| `'新建内容'` | `t('composer.newContent')` |
| `'关闭'` | `tc('close')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/composer/composer-dialog.tsx
git commit -m "feat(web): i18n composer-dialog component"
```

---

## 验证清单

- [ ] `pnpm build` 通过
- [ ] Issue 列表/详情/创建/编辑所有文本正确
- [ ] Issue 状态标签（中/英文）正确
- [ ] 编辑器面板标题和空状态正确
- [ ] Git 面板所有操作按钮和状态消息正确
- [ ] Terminal 面板标题和空状态正确
- [ ] 项目设置面板所有表单标签和通知配置正确
- [ ] Composer 对话框文本正确
- [ ] 无遗漏的硬编码文本（全局搜索验证）
