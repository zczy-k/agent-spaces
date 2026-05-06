# i18n 实施计划 — 第 2 波：核心 UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造侧边栏、登录页、首页、工作空间管理、Agent 配置、LLM 管理等核心 UI 组件的硬编码文本。

**Architecture:** 每个组件添加 `useTranslations('namespace')` hook，翻译 key 按功能域划分。需在 en.json 和 zh.json 中新增 `sidebar`、`login`、`home`、`workspace`、`workspaces`、`agent`、`models`、`providers` namespace，以及扩展 `common` namespace。

**Tech Stack:** next-intl useTranslations

**Spec:** `docs/superpowers/specs/2026-05-06-i18n-design.md`
**Depends on:** `docs/superpowers/plans/2026-05-06-i18n-wave1-infrastructure.md`

---

## 前置：扩展 common namespace 和新增核心 UI namespace

在 en.json 的 `common` 中新增以下 key（注意：`manage` 和 `active` 已在 Wave 1 中存在，仅新增缺失的 key）：

```json
{
  "common": {
    "saving": "Saving...",
    "you": "You",
    "user": "User",
    "refresh": "Refresh",
    "new": "New"
  }
}
```

zh.json 对应：

```json
{
  "common": {
    "saving": "保存中...",
    "you": "你",
    "user": "用户",
    "refresh": "刷新",
    "new": "新建"
  }
}
```

- [ ] **Step: 更新 common namespace 并 Commit**

```bash
git add packages/web/src/locales/
git commit -m "feat(web): extend common namespace with additional shared keys"
```

---

## Task 1: 改造 sidebar 组件（4 个文件）

**跳过文件说明：**
- `logo.tsx` — 纯 SVG 图标组件，`<title>Logo</title>` 为无障碍标签，不翻译

### 1a. 改造 app-sidebar.tsx

**Files:** Modify `packages/web/src/components/sidebar/app-sidebar.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `title: "Home"` | `t('nav.home')` |
| `title: "Workspaces"` | `t('nav.workspaces')` |
| `addLabel: "Add Workspace"` | `t('nav.addWorkspace')` |
| `title: "Settings"` | `t('nav.settings')` |
| `title: "General"` | `t('nav.general')` |
| `title: "Agents"` | `t('nav.agents')` |
| `title: "Models"` | `t('nav.models')` |
| `title: "Providers"` | `t('nav.providers')` |
| `label: "Edit"` | `tc('edit')` |
| `label: "Open"` | `tc('open')` |
| `label: "Delete"` | `tc('delete')` |
| 通知文本 (sampleNotifications) | 翻译通知模板文本 |

- [ ] **Step 1-3: 添加 import + hooks + 替换文本，验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/sidebar/app-sidebar.tsx
git commit -m "feat(web): i18n app-sidebar component"
```

### 1b. 改造 nav-main.tsx

**Files:** Modify `packages/web/src/components/sidebar/nav-main.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `route.addLabel ?? "Add"` | `route.addLabel`（由父组件传入已翻译文本） |
| `"Manage"` | `tc('manage')` |

注意：此组件接收 `Route` 对象的 `title`/`addLabel` 属性，这些在 app-sidebar 中已经翻译，nav-main 只需翻译自身硬编码的 `"Manage"` 和 `"Add"` 回退值。

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/components/sidebar/nav-main.tsx
git commit -m "feat(web): i18n nav-main component"
```

### 1c. 改造 nav-notifications.tsx

**Files:** Modify `packages/web/src/components/sidebar/nav-notifications.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `aria-label="Open notifications"` | `t('notifications.openAriaLabel')` |
| `"Notifications"` | `t('notifications.title')` |
| `"View all notifications"` | `t('notifications.viewAll')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/components/sidebar/nav-notifications.tsx
git commit -m "feat(web): i18n nav-notifications component"
```

### 1d. 改造 server-switcher.tsx

**Files:** Modify `packages/web/src/components/sidebar/server-switcher.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `"Servers"` | `t('server.servers')` |
| `"Add Server"` | `t('server.addServer')` |
| `"Manage Servers"` | `t('server.manageServers')` |
| `editingId ? "Edit Server" : "Add Server"` | `editingId ? t('server.editServer') : t('server.addServer')` |
| `"Update server connection details."` | `t('server.editDescription')` |
| `"Add an API server to connect to."` | `t('server.addDescription')` |
| `"Name"` | `tc('name')` |
| `"URL"` | `t('server.url')` |
| `"Secret"` | `t('server.secret')` |
| `"Optional API secret"` | `t('server.secretPlaceholder')` |
| `"Cancel"` | `tc('cancel')` |
| `editingId ? "Save" : "Add"` | `editingId ? tc('save') : tc('add')` |
| `"Manage Servers"` (dialog title) | `t('server.manageServers')` |
| `"Add, edit, or remove API server connections."` | `t('server.manageDescription')` |
| `"Save"` | `tc('save')` |
| `"X"` (cancel edit) | `tc('cancel')` |
| `"Active"` | `tc('active')` |
| `"New Server"` | `t('server.newServer')` |
| `"Secret (optional)"` | `t('server.secretOptionalPlaceholder')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/components/sidebar/server-switcher.tsx
git commit -m "feat(web): i18n server-switcher component"
```

---

## Task 2: 改造 login 页面

**Files:** Modify `packages/web/src/app/login/page.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `"Enter your secret key to continue"` | `t('subtitle')` |
| `"Secret key (leave empty if not set)"` | `t('secretPlaceholder')` |
| `loading ? "Verifying..." : "Login"` | `loading ? t('verifying') : t('login')` |
| `"Login failed"` | `t('loginFailed')` |
| `"Network error"` | `t('networkError')` |

注意：`"Agent Spaces"` 是品牌名，不翻译。

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/app/login/page.tsx
git commit -m "feat(web): i18n login page"
```

---

## Task 3: 改造 home 页面（usage-dashboard）

**Files:** Modify `packages/web/src/components/home/usage-dashboard.tsx`

注意：`home-page.tsx` 无硬编码文本，无需改造。

**需要替换的文本（约 50 处）：**

主要分类（namespace 统一使用 `home`，与 spec 保持一致）：
- **表格列头**: Agent, Model, Summary, Cost, Status, Duration, Time → `home.table.*`
- **时间段筛选**: 今日, 7 天, 30 天, 1 年, 自定义 → `home.period.*`
- **指标卡片**: Agent Runs, Tokens Used, Total Cost, Avg Duration → `home.metric.*`
- **图表标题**: Daily Token Usage, Cost by Model, Token Distribution, Cost Distribution → `home.chart.*`
- **分页文本**: Showing, to, of, entries, Previous, Next → `home.pagination.*`
- **相对时间**: just now, m ago, h ago, d ago → `home.time.*`
- **空状态**: No completed usage records yet, No results, Usage appears here... → `home.table.empty*`
- **图例**: Input, Output, tokens, total cost → `home.chart.*`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/home/usage-dashboard.tsx
git commit -m "feat(web): i18n usage-dashboard component"
```

---

## Task 4: 改造 workspace 组件（2 个文件）

### 4a. 改造 workspace-dialog.tsx

**Files:** Modify `packages/web/src/components/workspace/workspace-dialog.tsx`

**需要替换的文本（约 30 处）：**

主要分类：
- **Clone 进度阶段**: 计算对象中...、压缩中...、接收数据中...、解析中...、完成、失败 → `workspace.clone.phase.*`
- **对话框标题/描述**: Edit/New Workspace → `workspace.dialog.*`
- **表单字段**: Workspace name, Agents, Add Agent, No agents... → `workspace.dialog.*`
- **Clone 对话框**: 从 Git 创建、URL placeholder、进度信息 → `workspace.clone.*`
- **按钮**: Cancel, Save, Create, Clone, Cloning... → `common.*` + `workspace.clone.*`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/workspace/workspace-dialog.tsx
git commit -m "feat(web): i18n workspace-dialog component"
```

### 4b. 改造 workspaces-page.tsx

**Files:** Modify `packages/web/src/components/workspaces/workspaces-page.tsx`

**需要替换的文本：**

| 原文 | Key |
|------|-----|
| `"Workspaces"` | `t('title')` |
| `"New Workspace"` | `t('newWorkspace')` |
| `"No workspaces yet. Create one to get started."` | `t('emptyMessage')` |

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/workspaces/workspaces-page.tsx
git commit -m "feat(web): i18n workspaces-page component"
```

---

## Task 5: 改造 Agent 配置对话框

**Files:** Modify `packages/web/src/components/sidebar/agent-dialog.tsx`

此文件约有 80+ 处硬编码文本，是改造量最大的单个文件。主要分类：

- **Provider 选项** (5 个): Anthropic Messages, OpenAI Chat Completions, etc. → `agent.provider.*`
- **Runtime 选项** (3 个): Open Agent SDK, Claude Code, Codex → `agent.runtime.*`
- **角色模板** (7 个 × 3 字段 = 21 个): Scheduler/Planner/Executor/Reviewer/Commit/Bot/Custom 的 name/description/systemPrompt → `agent.role.*`
- **对话框标题/描述**: Agent Presets, Configure agent behavior... → `agent.dialog.*`
- **列表空状态**: No agent presets yet, No description → `agent.list.*`
- **详情表单** (30+ 个): Name, Role, Description, Runtime, Model, API Base, API Key, Temperature, Max Tokens, etc. → `agent.detail.*`
- **错误消息** (5 个): Failed to load/save/delete/test → `agent.error.*`
- **调试信息** (5 个): status:, provider:, url:, model:, body: → `agent.debug.*`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/sidebar/agent-dialog.tsx
git commit -m "feat(web): i18n agent-dialog component"
```

---

## Task 6: 改造 LLM 管理对话框（2 个文件）

### 6a. 改造 models-dialog.tsx

**Files:** Modify `packages/web/src/components/sidebar/models-dialog.tsx`

**需要替换的文本（约 35 处）：**

主要分类：
- **能力标签**: Vision, Reasoning, Embedding → `models.capability.*`
- **对话框**: Edit/Add Model, Models → `models.dialog.*`
- **表单**: Model ID, Display Name, Provider, Context, Thinking, Cost, Capabilities → `models.form.*`
- **列表**: ctx, No models yet → `models.list.*`
- **错误/确认**: Failed to save/delete, Delete this model? → `models.error.*` / `models.confirm.*`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/sidebar/models-dialog.tsx
git commit -m "feat(web): i18n models-dialog component"
```

### 6b. 改造 providers-dialog.tsx

**Files:** Modify `packages/web/src/components/sidebar/providers-dialog.tsx`

**需要替换的文本（约 20 处）：**

主要分类：
- **对话框**: Edit/Add Provider, Providers → `providers.dialog.*`
- **表单**: Name, API Base, API Key → `providers.form.*`
- **列表**: No API base configured, models count, Add model, No providers yet → `providers.list.*`
- **错误/确认**: Failed to save/delete, Delete this provider? → `providers.error.*` / `providers.confirm.*`

- [ ] **Step: 替换后验证构建并 Commit**

```bash
git add packages/web/src/locales/ packages/web/src/components/sidebar/providers-dialog.tsx
git commit -m "feat(web): i18n providers-dialog component"
```

---

## 验证清单

- [ ] `pnpm build` 通过
- [ ] 侧边栏导航文本正确切换中英文
- [ ] 服务器切换器所有文本正确
- [ ] 登录页文本正确
- [ ] 首页 Dashboard 表格/图表/筛选器文本正确
- [ ] 工作空间对话框和列表页文本正确
- [ ] Agent 配置对话框所有字段标签正确
- [ ] LLM 模型和供应商管理对话框文本正确
- [ ] 通用按钮（Save/Cancel/Delete）在所有组件中一致
