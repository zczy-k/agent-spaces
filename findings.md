# Findings & Decisions

## Requirements
- Build a local multi-agent collaborative coding platform.
- Frontend stack: Next.js, shadcn/ui, TailwindCSS.
- Backend stack: Express plus WebSocket/WSS.
- Single-user product; no login or account system required.
- Web frontend and backend are separate.
- A workspace can bind multiple local code directories.
- Each workspace claims exactly one `.agentspace` directory.
- `.agentspace` stores workspace metadata, skills, agent config, `claude.md`, tasks, cache/locks, and logs.
- New Git branches must include the `.agentspace` folder.
- Only the Planner role may update `.agentspace` content.
- Shared execution records live under `share/{issue_id}`.
- Each agent writes independent Markdown execution records.
- Historical execution records are archived under `archive/`.
- Agent roles include Scheduler, Planner, Executor, and Reviewer.
- Scheduler only wakes Planner when the server is idle and unfinished issues exist.
- Planner manages issues, task decomposition, agent creation, task distribution, result handling, documentation updates, and PR creation.
- Planner does not directly read or write code.
- Executor performs code analysis and modification within sandboxed assigned directories and limited tools.
- Reviewer reviews diffs and returns approve, request changes, or reject.
- Hooks connect executor completion, planner notification, reviewer review, and planner follow-up.
- Channel chat supports agent mentions, attachments, history search, and file/code snippet references.
- Issue center supports fuzzy issue creation, research agent planning, standardized `skill.md` plan files, and user editing.
- Code editor uses Monaco Editor with file tree, editor tabs, folder browsing, file modification, and Git operations.
- Layout includes workspace tabs, left panel, right panel, and bottom dock.
- Bottom dock includes terminal, Codex, Claude Code, VSCode debugging, and Git.
- Terminal supports resize and multiple sessions.
- Dock layout should use FlexLayout.
- Terminal UI should use xterm.js.
- Codex integration should target OpenAI Codex.
- Claude Code integration should consider `open-agent-sdk-typescript`.
- VSCode debugging/inspection panel should consider `react-dev-inspector`.
- Git panel initially supports diff viewing, with future commit/push/pull/branch/merge/log expansion.
- Storage is local filesystem only and should support Windows, macOS, and Linux.
- File operations are unrestricted by whitelist and do not provide undo/rollback.
- Git diff files should be generated to track file changes.
- Current storage format is JSON, with possible future database migration.
- Current scope does not require indexing, search implementation, automatic backups, or version history.
- GitHub/GitLab integration is required for branch creation, commit, and PR synchronization.

## Research Findings
- Current workspace contains `PRD.md` and no existing application scaffold.
- No existing `task_plan.md`, `findings.md`, or `progress.md` were present before this session.
- The PRD defines state enums but does not define exact transition rules.
- The PRD defines required storage areas but does not yet define JSON schemas.
- The PRD requires broad filesystem access but also role-based control over `.agentspace`, creating a security boundary that must be designed explicitly.
- The user supplied concrete library/repository candidates for dock layout, terminal, Codex, Claude Code, and VSCode inspection/debug integration.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Start with explicit architecture and MVP planning before implementation | The workspace currently has only a PRD, so implementation needs contract and scope definition first. |
| Separate agent orchestration from concrete agent runtime execution | Scheduler, Planner, Executor, Reviewer, and hooks are complex enough to need stable interfaces before real process execution. |
| Use local JSON schemas as the first persistence target | The PRD explicitly states JSON storage first and database migration later. |
| Treat `share/{issue_id}` records as append-only Markdown artifacts with archiving | This matches the PRD's readable execution record and history archive requirements. |
| Model Git provider integration behind an adapter boundary | GitHub/GitLab are both required, and provider-specific behavior should not leak into issue orchestration. |
| Prefer FlexLayout for dock/panel layout | User supplied `https://github.com/caplin/FlexLayout` as the dock layout candidate. |
| Prefer xterm.js for terminal rendering | User supplied `https://github.com/xtermjs/xterm.js` as the terminal candidate. |
| Wrap Codex and Claude Code behind agent runtime adapters | User supplied separate candidates for Codex and Claude Code, so orchestration should not depend directly on one runtime implementation. |
| Evaluate react-dev-inspector for VSCode-style debug/inspection workflows | User supplied `https://github.com/zthxxx/react-dev-inspector` for the VSCode debug area; exact fit needs validation. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| PRD lacks precise MVP boundary | Add MVP scoping as a dedicated planning phase. |
| PRD has potential tension between unrestricted file writes and `.agentspace` Planner-only writes | Track as a risk and define enforcement rules during architecture planning. |
| PRD requires PR sync to GitHub/GitLab but does not specify auth method | Track as an unresolved product/technical question. |
| Supplied GitHub repositories have not been validated in this session | Verify install packages, APIs, licenses, maintenance status, and framework compatibility during Phase 2. |

## Resources
- Local PRD: `/Users/Zhuanz/Documents/agent_spaces/PRD.md`
- Planning skill: `/Users/Zhuanz/.agents/skills/planning-with-files/SKILL.md`
- Planning templates: `/Users/Zhuanz/.agents/skills/planning-with-files/templates/`
- Dock layout: https://github.com/caplin/FlexLayout
- Terminal: https://github.com/xtermjs/xterm.js
- Codex: https://github.com/openai/codex
- Claude Code / agent SDK candidate: https://github.com/codeany-ai/open-agent-sdk-typescript
- VSCode debug/inspection candidate: https://github.com/zthxxx/react-dev-inspector

## Open Questions
1. Should MVP implement real Codex/Claude Code process control, or simulate agent runs while stabilizing workspace, issue, and review flows?
2. Which provider auth should be used for GitHub/GitLab integration: PAT, OAuth device flow, local CLI credentials, or user-provided tokens?
3. Should the backend expose unrestricted file operations to the frontend, or should restrictions apply only to automated agents?
4. How should conflicts be handled when multiple bound directories contain or request `.agentspace`?
5. What exact format should standardized research plan `skill.md` files follow?
6. Should the app support opening arbitrary existing repos that already contain `.agentspace`?
7. Should terminal sessions run in the backend process or be delegated to an external terminal multiplexer?
8. What package names and APIs correspond to the supplied GitHub repositories?
9. Does FlexLayout satisfy all dock requirements: bottom dock, nested tabs, drag resizing, persisted layout, and panel restore?
10. Should Codex and Claude Code run as local CLI processes, SDK calls, or remote service calls?
11. Does `react-dev-inspector` cover the intended VSCode debugging requirement, or only component/source inspection?

## Visual/Browser Findings
- No browser or visual assets were used during initial PRD planning.

---

## Phase 2: Architecture Definition

### 2.1 Package Structure (Monorepo)

```
agent-spaces/
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── PRD.md
├── task_plan.md / findings.md / progress.md
│
├── packages/
│   ├── shared/                   # @agent-spaces/shared
│   │   ├── src/
│   │   │   ├── types/            # 共享类型定义
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── issue.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── channel.ts
│   │   │   │   ├── message.ts
│   │   │   │   └── events.ts     # WebSocket 事件类型
│   │   │   ├── constants/        # 状态枚举、角色枚举
│   │   │   └── utils/            # 共享工具函数
│   │   └── package.json
│   │
│   ├── server/                   # @agent-spaces/server
│   │   ├── src/
│   │   │   ├── app.ts            # Express + WebSocket 入口
│   │   │   ├── routes/           # REST API 路由
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── issue.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── channel.ts
│   │   │   │   ├── file.ts       # 文件系统操作
│   │   │   │   └── git.ts
│   │   │   ├── ws/               # WebSocket handlers
│   │   │   │   ├── connection.ts
│   │   │   │   ├── channels/     # 按领域分的 WS 频道
│   │   │   │   └── events.ts
│   │   │   ├── services/         # 业务逻辑
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── issue.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── channel.ts
│   │   │   │   ├── agent.ts      # Agent 生命周期管理
│   │   │   │   └── scheduler.ts
│   │   │   ├── agents/           # Agent 角色实现
│   │   │   │   ├── scheduler-agent.ts
│   │   │   │   ├── planner-agent.ts
│   │   │   │   ├── executor-agent.ts
│   │   │   │   └── reviewer-agent.ts
│   │   │   ├── adapters/         # 外部工具适配器
│   │   │   │   ├── codex.ts      # Codex 适配器
│   │   │   │   ├── claude.ts     # Claude Code 适配器
│   │   │   │   └── git.ts        # Git 操作适配器
│   │   │   ├── hooks/            # Agent Hook 系统
│   │   │   │   ├── executor-complete.ts
│   │   │   │   ├── planner-notify.ts
│   │   │   │   └── reviewer-result.ts
│   │   │   ├── storage/          # 持久化层
│   │   │   │   ├── json-store.ts # JSON 文件读写
│   │   │   │   ├── workspace-store.ts
│   │   │   │   ├── issue-store.ts
│   │   │   │   └── agent-store.ts
│   │   │   └── pty/              # 终端 PTY 管理
│   │   │       └── session.ts    # node-pty 会话管理
│   │   └── package.json
│   │
│   └── web/                      # @agent-spaces/web
│       ├── src/
│       │   ├── app/              # Next.js App Router
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx      # 首页/工作空间选择
│       │   │   └── workspace/
│       │   │       └── [id]/
│       │   │           └── page.tsx
│       │   ├── components/
│       │   │   ├── layout/       # FlexLayout 集成
│       │   │   │   ├── workspace-shell.tsx
│       │   │   │   ├── dock-layout.tsx
│       │   │   │   └── panel-wrapper.tsx
│       │   │   ├── chat/         # 频道聊天
│       │   │   │   ├── channel-list.tsx
│       │   │   │   ├── chat-panel.tsx
│       │   │   │   └── message-item.tsx
│       │   │   ├── issue/        # 议题中心
│       │   │   │   ├── issue-list.tsx
│       │   │   │   ├── issue-detail.tsx
│       │   │   │   └── plan-editor.tsx
│       │   │   ├── editor/       # Monaco 编辑器
│       │   │   │   ├── file-tree.tsx
│       │   │   │   ├── code-editor.tsx
│       │   │   │   └── editor-tabs.tsx
│       │   │   ├── terminal/     # xterm.js 终端
│       │   │   │   ├── terminal-panel.tsx
│       │   │   │   └── terminal-tab.tsx
│       │   │   ├── git/          # Git 面板
│       │   │   │   ├── diff-viewer.tsx
│       │   │   │   └── git-panel.tsx
│       │   │   └── agent/        # Agent 状态/控制
│       │   │       ├── agent-status.tsx
│       │   │       └── agent-panel.tsx
│       │   ├── hooks/            # 自定义 React hooks
│       │   │   ├── use-websocket.ts
│       │   │   ├── use-workspace.ts
│       │   │   └── use-terminal.ts
│       │   ├── stores/           # 状态管理 (zustand)
│       │   │   ├── workspace.ts
│       │   │   ├── issue.ts
│       │   │   ├── channel.ts
│       │   │   └── layout.ts
│       │   └── lib/              # 工具函数
│       │       ├── ws-client.ts
│       │       └── api.ts
│       ├── package.json
│       └── next.config.ts
│
└── .agentspace/                   # 工作空间元数据（示例）
    ├── skills/
    ├── agents/
    ├── claude.md
    ├── tasks/
    ├── cache/
    └── logs/
```

### 2.2 Data Models

#### Workspace
```typescript
interface Workspace {
  id: string;                     // uuid
  name: string;
  boundDirs: string[];            // 绑定的本地代码目录
  agentspaceDir: string;          // 认领的 .agentspace 目录路径
  createdAt: string;              // ISO timestamp
  updatedAt: string;
  activeChannels: string[];       // channel IDs
  activeIssues: string[];         // issue IDs
  agents: AgentConfig[];          // 该 workspace 的 agent 配置
}

interface AgentConfig {
  id: string;
  role: 'scheduler' | 'planner' | 'executor' | 'reviewer';
  modelProvider?: string;         // e.g. 'codex', 'claude'
  modelId?: string;
  sandboxDirs?: string[];         // executor 限制目录
  maxRetries?: number;
  enabled: boolean;
}
```

#### Issue
```typescript
type IssueStatus =
  | 'draft' | 'planned' | 'in_progress' | 'review_pending'
  | 'changes_requested' | 'approved' | 'completed' | 'archived' | 'error';

interface Issue {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: IssueStatus;
  planFile?: string;              // skill.md 计划文件路径
  tasks: string[];                // task IDs
  assignedAgents: string[];       // agent session IDs
  branch?: string;                // 关联的 Git 分支
  prUrl?: string;                 // PR URL
  createdAt: string;
  updatedAt: string;
}
```

#### Task
```typescript
type TaskStatus =
  | 'pending' | 'running' | 'waiting_review'
  | 'retrying' | 'done' | 'failed' | 'cancelled';

interface Task {
  id: string;
  issueId: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAgentId?: string;       // agent session ID
  sandboxDirs?: string[];         // 执行目录限制
  executionLog?: string;          // 执行记录文件路径
  diffFiles?: string[];           // 修改的文件列表
  retryCount: number;
  maxRetries: number;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
}

interface TaskResult {
  success: boolean;
  summary: string;
  artifacts: string[];            // 产出文件路径
  error?: string;
}
```

#### Agent Session
```typescript
type AgentSessionStatus =
  | 'idle' | 'active' | 'blocked' | 'completed' | 'crashed';

interface AgentSession {
  id: string;
  workspaceId: string;
  agentConfigId: string;
  role: 'scheduler' | 'planner' | 'executor' | 'reviewer';
  status: AgentSessionStatus;
  currentTaskId?: string;
  processId?: number;             // 子进程 PID（如有）
  startedAt: string;
  lastActivityAt: string;
  error?: string;
}
```

#### Channel & Message
```typescript
interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  type: 'general' | 'issue' | 'agent';
  members: string[];              // agent config IDs + 'user'
  createdAt: string;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;               // agent config ID 或 'user'
  senderRole?: string;
  content: string;
  type: 'text' | 'mention' | 'attachment' | 'code_ref' | 'file_ref';
  attachments?: Attachment[];
  codeRef?: { file: string; range: [number, number] };
  createdAt: string;
}

interface Attachment {
  name: string;
  path: string;
  type: string;
}
```

### 2.3 `.agentspace` 目录结构
```
.agentspace/
├── workspace.json                # Workspace 元数据
├── claude.md                     # 知识模型初始化文件
├── skills/
│   └── *.md                      # 技能文件
├── agents/
│   └── *.json                    # Agent 配置
├── tasks/
│   └── *.json                    # 任务数据
├── cache/
│   └── locks/                    # 锁文件
└── logs/
    └── *.md                      # 执行日志
```

### 2.4 `share/` 目录结构
```
share/
├── {issue_id}/
│   ├── {agent_id}_exec_{timestamp}.md   # 执行记录
│   └── {agent_id}_review_{timestamp}.md # 审核记录
└── archive/
    └── {issue_id}/
        └── ...                          # 封存的历史记录
```

### 2.5 WebSocket 事件契约

#### 连接
- 客户端连接 `ws://localhost:{port}/ws?workspaceId={id}`
- 服务端返回 `connected` 事件

#### 事件命名规范: `{domain}.{action}`

```typescript
// ---- Workspace ----
'workspace.updated'         // workspace 配置变更广播
'workspace.agents.changed'  // agent 列表/状态变更

// ---- Issue ----
'issue.created'
'issue.updated'             // 状态/内容变更
'issue.status_changed'      // 状态流转通知

// ---- Task ----
'task.created'
'task.updated'
'task.status_changed'
'task.output'               // 实时执行输出 (stream)

// ---- Agent ----
'agent.started'
'agent.status_changed'
'agent.output'              // agent 实时输出 (stream)
'agent.completed'
'agent.error'

// ---- Channel ----
'channel.message'           // 新消息
'channel.typing'            // 正在输入
'channel.updated'

// ---- Terminal ----
'terminal.created'          // 新建终端会话
'terminal.output'           // PTY 输出数据
'terminal.input'            // 客户端→服务端输入
'terminal.resize'           // 终端大小变更
'terminal.closed'           // 终端关闭

// ---- File System ----
'file.changed'              // 文件变更通知
'file.tree.updated'         // 文件树刷新

// ---- Git ----
'git.status_changed'        // 工作区状态变更
'git.diff.updated'          // diff 更新
```

#### 事件载荷格式
```typescript
interface WSEvent<T = unknown> {
  event: string;           // 事件名
  workspaceId: string;     // 所属 workspace
  timestamp: string;       // ISO timestamp
  data: T;                 // 载荷数据
}
```

### 2.6 Issue 状态转换规则
```
draft → planned              (Planner 完成规划)
planned → in_progress        (第一个 task 开始执行)
in_progress → review_pending (所有 task 完成, 进入审核)
review_pending → approved    (Reviewer 通过)
review_pending → changes_requested (Reviewer 要求修改)
changes_requested → in_progress (重新分配 task 执行)
approved → completed         (PR 创建/合并完成)
completed → archived         (手动归档)
任意状态 → error              (执行异常)
```

### 2.7 Task 状态转换规则
```
pending → running            (Executor 开始执行)
running → waiting_review     (执行完成, 等待审核)
running → failed             (执行失败)
running → done               (执行成功, 无需审核)
waiting_review → done        (审核通过)
waiting_review → retrying    (审核不通过, 需重试)
retrying → running           (重新执行)
retrying → failed            (超过最大重试次数)
任意状态 → cancelled          (手动取消)
```

### 2.8 Agent Session 状态转换规则
```
idle → active                (收到任务分配)
active → blocked             (等待外部输入/审核)
active → completed           (任务完成)
active → crashed             (进程异常退出)
blocked → active             (外部条件满足)
```

### 2.9 服务边界

#### REST API
| Method | Path | 描述 |
|--------|------|------|
| GET | /api/workspaces | 列出工作空间 |
| POST | /api/workspaces | 创建工作空间 |
| GET | /api/workspaces/:id | 获取工作空间详情 |
| PUT | /api/workspaces/:id | 更新工作空间 |
| DELETE | /api/workspaces/:id | 删除工作空间 |
| GET | /api/workspaces/:id/issues | 列出议题 |
| POST | /api/workspaces/:id/issues | 创建议题 |
| GET | /api/workspaces/:id/issues/:issueId | 获取议题 |
| PUT | /api/workspaces/:id/issues/:issueId | 更新议题 |
| GET | /api/workspaces/:id/tasks | 列出任务 |
| POST | /api/workspaces/:id/tasks | 创建任务 |
| GET | /api/workspaces/:id/channels | 列出频道 |
| POST | /api/workspaces/:id/channels | 创建频道 |
| GET | /api/workspaces/:id/channels/:chId/messages | 获取消息 |
| POST | /api/workspaces/:id/channels/:chId/messages | 发送消息 |
| GET | /api/workspaces/:id/files/tree | 获取文件树 |
| GET | /api/workspaces/:id/files/content | 读取文件内容 |
| PUT | /api/workspaces/:id/files/content | 写入文件 |
| GET | /api/workspaces/:id/git/status | Git 状态 |
| GET | /api/workspaces/:id/git/diff | Git diff |
| POST | /api/workspaces/:id/git/commit | Git commit |
| POST | /api/workspaces/:id/git/push | Git push |
| POST | /api/workspaces/:id/agents/start | 启动 agent |
| POST | /api/workspaces/:id/agents/:agentId/stop | 停止 agent |
| GET | /api/workspaces/:id/agents | 列出 agent 状态 |

#### WebSocket 频道 (复用单连接, 通过事件名区分)
- 单一 WebSocket 连接, 所有事件通过 `event` 字段路由
- 无需订阅/取消订阅, 连接即接收该 workspace 全部事件

#### 文件系统服务边界
- 后端直接操作本地文件系统 (fs API)
- 前端通过 REST API 读写文件
- Agent 通过后端 service 层操作文件 (受 sandbox 约束)
- `.agentspace` 写入仅限 Planner agent

#### Git 服务边界
- 使用 `isomorphic-git` 或 `simple-git` (Node.js) 执行 Git 操作
- GitHub/GitLab PR 操作通过对应 REST API (`@octokit/rest`, `@gitbeaker/rest`)
- 认证: 用户配置 PAT token (存储在 `.agentspace/agents/` 配置中)

### 2.10 库验证结果

#### FlexLayout (`flexlayout-react`)
- **NPM:** `flexlayout-react` | **License:** MIT | **Stars:** 1.2k
- **最新版:** v0.8.18 (2026-01-14) | **被 562 个项目使用**
- **结论: ✅ 推荐** — 满足所有需求：bottom dock、nested tabs、drag resizing、JSON 持久化、panel hide/show
- **注意:** React-only，popout 窗口有已知限制，157 个 open issue 需关注
- **集成方式:** JSON Model 定义布局，Factory 模式渲染组件，`model.toJson()` / `Model.fromJson()` 持久化

#### xterm.js (`@xterm/xterm`)
- **NPM:** `@xterm/xterm` | **License:** MIT | **Stars:** 20.3k
- **最新版:** v6.0.0 (2025-12-22) | VS Code、Hyper、JupyterLab 等使用
- **结论: ✅ 推荐** — 完美匹配终端需求
- **关键 Addons:** `@xterm/addon-attach` (WebSocket), `@xterm/addon-fit` (自适应大小)
- **后端搭配:** `node-pty` (PTY 进程管理)
- **集成方式:** 多实例 = 多终端 tab，每个实例绑定独立 WebSocket → 独立 PTY session

#### Agent 运行时 (`@codeany/open-agent-sdk`)
- **NPM:** `@codeany/open-agent-sdk` | **License:** MIT
- **最新版:** v0.2.1 | 新发布但活跃维护
- **结论: ✅ 推荐** — 最适合后端 Agent 集成
- **能力:** 35+ 内置工具，完整 agent loop，session 持久化，streaming API，MCP 集成
- **多模型:** 支持 Anthropic Claude、OpenAI、DeepSeek、Qwen 等
- **不依赖 CLI 子进程:** 进程内执行，适合服务端集成

#### OpenAI Codex (`@openai/codex`)
- **类型:** CLI 工具 (Rust 实现)，不是 SDK
- **结论: ❌ 不推荐** — 无法作为后端服务集成
- **替代:** 通过 `@codeany/open-agent-sdk` 的 OpenAI provider 支持来实现类似功能

#### Anthropic SDK (`@anthropic-ai/sdk`)
- **类型:** API 客户端，非 agent 框架
- **结论:** 作为底层 LLM 调用使用，不直接构建 agent loop
- **与 open-agent-sdk 关系:** open-agent-sdk 内部可使用此 SDK 作为 Anthropic provider

#### react-dev-inspector
- **NPM:** `react-dev-inspector` | **License:** MIT
- **结论: ❌ 不满足需求** — 仅支持点击跳转源码（开发模式），无组件调试/状态检查/断点功能
- **替代方案:** 底部 dock 的 "VSCode 调试" 面板改为以下组合:
  1. 使用 Chrome DevTools Protocol (CDP) 集成基础调试
  2. 或简化为"代码检查"面板（AST 分析 + 源码跳转）
  3. 或移至 post-MVP，初期仅保留 Codex/Claude Code/Git/Terminal 四个 dock tab

### 2.11 架构决策汇总

| 决策 | 选择 | 理由 |
|------|------|------|
| 包管理 | pnpm workspace (monorepo) | 前后端共享类型，统一版本管理 |
| 状态管理 (前端) | Zustand | 轻量，适合 WS 驱动的实时状态 |
| 组件库 | shadcn/ui + TailwindCSS | PRD 指定 |
| 布局引擎 | flexlayout-react | 库验证通过，满足全部 dock 需求 |
| 终端 | @xterm/xterm + node-pty | 库验证通过，业界标准 |
| Agent 运行时 | @codeany/open-agent-sdk | 进程内执行，多模型支持，35+ 工具 |
| LLM 调用 | @anthropic-ai/sdk + open-agent-sdk | SDK 作为 provider 层，open-agent-sdk 编排 agent loop |
| Git 操作 (后端) | simple-git | Node.js 原生，跨平台 |
| Git Provider API | @octokit/rest (GitHub) + @gitbeaker/rest (GitLab) | 标准 REST API 客户端 |
| 代码编辑器 | Monaco Editor | PRD 指定 |
| 文件差异查看 | Monaco Diff Editor | 内置支持 |
| VSCode 调试面板 | 移至 post-MVP | react-dev-inspector 不满足需求，初期聚焦核心功能 |
| 实时通信 | ws (WebSocket) | Express 集成简单，单 workspace 单连接 |
| 持久化 | 本地 JSON 文件 | PRD 指定，后续迁移数据库 |
| 路由 (前端) | Next.js App Router | PRD 指定 |
| 运行时 | Node.js | 全栈 TypeScript 统一 |

---

## Phase 3: MVP Scope Breakdown

### 3.1 MVP 边界定义

**MVP 目标:** 单用户能创建工作空间、绑定目录、创建议题、看到 Agent 自动分解/执行/审核任务、在终端中观察 Agent 输出、在编辑器中查看文件变更。

#### MVP 包含
| 模块 | 功能 |
|------|------|
| Workspace | 创建/删除/切换工作空间，绑定本地目录，.agentspace 初始化 |
| Issue | 创建议题（draft）、Planner 自动规划、状态流转 |
| Task | Planner 分解任务、Executor 执行、状态流转 |
| Agent | Scheduler 周期触发、Planner 规划、Executor 执行、Reviewer 审核 |
| Hook | 执行完成→通知 Planner→触发 Reviewer→结果处理 |
| Channel | 基础聊天（文本消息）、@mention Agent |
| Terminal | xterm.js 多 tab 终端，WebSocket PTY |
| Code Editor | Monaco Editor，文件树，文件读写 |
| Git | diff 查看 |
| Layout | FlexLayout: workspace tabs + 左右面板 + bottom dock (terminal, git) |

#### MVP 不包含 (Post-MVP)
| 模块 | 延后原因 |
|------|----------|
| Codex dock tab | open-agent-sdk 已覆盖 agent 运行时，Codex 作为 CLI 集成优先级低 |
| Claude Code dock tab | 同上，agent 运行时统一用 open-agent-sdk |
| VSCode 调试面板 | react-dev-inspector 不满足需求，需重新设计 |
| Chat 搜索/附件/代码引用 | 复杂度高，MVP 先支持纯文本 |
| Issue plan editor (skill.md) | MVP 先自动生成，不支持用户手动编辑 |
| Git commit/push/pull/branch/merge | 先只看 diff |
| GitHub/GitLab PR 创建 | 先本地完成，PR 集成延后 |
| 多模型配置/上下文压缩 | 后续扩展 |
| Archive 归档 | 先不做 |
| 文件搜索/索引 | PRD 明确排除 |

### 3.2 第一个可用垂直切片

**切片:** 用户创建工作空间 → 绑定一个代码目录 → 创建一个议题 → 看到 Planner 分解任务 → Executor 执行代码修改 → Reviewer 审核 diff → 用户在频道看到结果通知

**验收标准:**
1. 能通过 Web UI 创建 workspace 并绑定本地目录
2. `.agentspace` 目录自动初始化
3. 能创建 issue 并看到状态从 draft → planned → in_progress
4. Agent 自动执行任务，终端 tab 显示 agent 输出
5. 文件树能看到 agent 修改的文件
6. Git diff 面板能看到变更
7. Channel 有 agent 完成通知

### 3.3 实现里程碑

#### M1: 项目脚手架 + 基础布局
- pnpm monorepo 初始化
- Next.js + Express 项目创建
- FlexLayout 基础 shell (workspace tabs, 左右面板, bottom dock)
- 基础路由: `/` (workspace 列表), `/workspace/[id]` (工作空间)

#### M2: Workspace + 文件系统
- Workspace CRUD API + 存储
- 文件树浏览 API
- Monaco Editor 集成 + 文件读写 API
- .agentspace 自动初始化

#### M3: Terminal + WebSocket 基础
- WebSocket 连接管理
- xterm.js + node-pty 终端 tab
- 多终端会话管理

#### M4: Channel + Message
- Channel CRUD + Message 收发
- WebSocket 实时消息推送
- @mention Agent (UI 展示)

#### M5: Agent 系统 (核心)
- Agent 配置 + Session 生命周期
- Scheduler: 周期检查 + 唤醒 Planner
- Planner: 接收 issue → 分解 task → 分配 Executor
- Executor: 通过 open-agent-sdk 执行代码修改
- Reviewer: diff 审核 + 结论
- Hook: executor 完成 → planner 通知 → reviewer 审核 → 结果处理

#### M6: Issue + Task 管理
- Issue CRUD + 状态机
- Task CRUD + 状态机
- Issue detail 面板 (状态、task 列表、执行日志)

#### M7: Git Diff + 整合测试
- Git status API
- Git diff 面板 (Monaco Diff Editor)
- 端到端流程测试: 创建 issue → agent 执行 → 查看结果

---

## Phase 4: Backend Implementation Plan

### 4.1 Express API 路由

#### Workspace Routes (`/api/workspaces`)
```
GET    /                        # 列出所有 workspace
POST   /                        # 创建 workspace { name, boundDirs }
GET    /:id                     # 获取详情
PUT    /:id                     # 更新配置
DELETE /:id                     # 删除 workspace
```

#### Issue Routes (`/api/workspaces/:id/issues`)
```
GET    /                        # 列出 issue (支持 status 过滤)
POST   /                        # 创建 issue { title, description }
GET    /:issueId                # 获取详情 (含 task 列表)
PUT    /:issueId                # 更新 issue (标题、描述、手动状态变更)
POST   /:issueId/start          # 手动触发 Planner 规划
```

#### Task Routes (`/api/workspaces/:id/tasks`)
```
GET    /                        # 列出 task (支持 issueId, status 过滤)
GET    /:taskId                 # 获取详情 (含执行日志)
POST   /:taskId/retry           # 手动重试
POST   /:taskId/cancel          # 手动取消
```

#### Channel Routes (`/api/workspaces/:id/channels`)
```
GET    /                        # 列出频道
POST   /                        # 创建频道 { name, type }
GET    /:channelId/messages     # 获取消息 (分页)
POST   /:channelId/messages     # 发送消息 { content, type }
```

#### File Routes (`/api/workspaces/:id/files`)
```
GET    /tree                    # 文件树 (支持 path 参数)
GET    /content?path=           # 读取文件内容
PUT    /content                 # 写入文件 { path, content }
```

#### Git Routes (`/api/workspaces/:id/git`)
```
GET    /status                  # git status
GET    /diff                    # git diff (支持 path 参数)
```

#### Agent Routes (`/api/workspaces/:id/agents`)
```
GET    /                        # 列出 agent session 状态
POST   /start                   # 启动 agent { role, taskId? }
POST   /:agentId/stop           # 停止 agent
```

### 4.2 WebSocket 频道设计

单连接模型：客户端连接 `ws://localhost:{port}/ws?workspaceId={id}`，所有事件通过 event name 路由。

```typescript
// 服务端 → 客户端
ServerEvents:
  'connected'           → { workspaceId }
  'workspace.updated'   → Workspace
  'issue.created'       → Issue
  'issue.updated'       → Issue
  'issue.status_changed' → { issueId, from, to }
  'task.created'        → Task
  'task.updated'        → Task
  'task.status_changed' → { taskId, from, to }
  'task.output'         → { taskId, data: string }  // 实时输出流
  'agent.started'       → AgentSession
  'agent.status_changed' → { agentId, from, to }
  'agent.output'        → { agentId, data: string }  // agent 输出流
  'agent.completed'     → { agentId, result }
  'agent.error'         → { agentId, error }
  'channel.message'     → Message
  'terminal.output'     → { sessionId, data: string }
  'terminal.closed'     → { sessionId }
  'file.changed'        → { path, type: 'created'|'modified'|'deleted' }
  'git.status_changed'  → GitStatus

// 客户端 → 服务端
ClientEvents:
  'terminal.input'      → { sessionId, data: string }
  'terminal.resize'     → { sessionId, cols, rows }
  'channel.message'     → { channelId, content, type }
  'terminal.create'     → { cwd?: string }  // 请求新建终端
  'terminal.close'      → { sessionId }
```

### 4.3 本地 JSON 持久化布局

```
~/.agent-spaces-data/            # 全局数据目录
├── workspaces/
│   └── {workspace-id}/
│       ├── workspace.json       # Workspace 元数据
│       ├── issues/
│       │   ├── index.json       # Issue 列表
│       │   └── {issue-id}.json  # Issue 详情 (含 task IDs)
│       ├── tasks/
│       │   ├── index.json
│       │   └── {task-id}.json
│       ├── channels/
│       │   ├── index.json
│       │   └── {channel-id}/
│       │       └── messages.json  # 消息列表 (append-only)
│       └── agents/
│           ├── index.json       # Agent session 列表
│           └── {session-id}.json
└── config.json                  # 全局配置 (端口、模型等)
```

### 4.4 Workspace 绑定与 `.agentspace` 认领规则

1. **创建 workspace 时:**
   - 用户指定一个或多个本地目录作为 `boundDirs`
   - 系统在第一个 boundDir 下创建 `.agentspace/` 目录
   - 如果 `.agentspace/` 已存在，直接认领

2. **`.agentspace` 写入规则:**
   - 只有 Planner agent 的 session 可以写入 `.agentspace/`
   - 其他 agent 和前端直接操作被拒绝
   - 后端 service 层校验写入者身份

3. **Git 分支规则:**
   - 创建新分支时确保 `.agentspace/` 被包含
   - 通过 `.gitignore` 白名单确保 `.agentspace/` 不被忽略

### 4.5 Agent 编排流程

```
Scheduler (定时)
  │
  ├─ 检查: 服务器空闲 && 有未完成 issue?
  │
  └─ 是 → 唤醒 Planner
          │
          ├─ 读取 issue → 分解 tasks
          ├─ 为每个 task 创建 Executor session
          ├─ 更新 .agentspace 内容
          │
          └─ Executor (并行/串行)
              │
              ├─ 接收 task + sandbox dirs
              ├─ 通过 open-agent-sdk 执行
              ├─ 写入 share/{issue_id}/ 执行记录
              │
              └─ Hook: executor-complete
                  │
                  └─ Planner 收到通知
                      │
                      ├─ 创建 Reviewer session
                      │
                      └─ Reviewer
                          │
                          ├─ 读取 diff
                          ├─ 输出审核结论
                          ├─ 写入 share/{issue_id}/ 审核记录
                          │
                          └─ Hook: reviewer-result
                              │
                              └─ Planner 收到审核结果
                                  │
                                  ├─ approved → 更新 issue, 通知 channel
                                  ├─ changes_requested → 重新分配 task
                                  └─ rejected → 标记 issue error
```

### 4.6 open-agent-sdk 适配器设计

```typescript
// packages/server/src/adapters/agent-runtime.ts

interface AgentRuntimeConfig {
  model: string;           // e.g. 'claude-sonnet-4-6'
  provider: 'anthropic' | 'openai' | 'openai-compatible';
  apiKey: string;
  maxTurns: number;
  permissionMode: 'bypassPermissions' | 'default';
  workingDir: string;      // sandbox 目录
  tools?: string[];        // 允许的工具列表
}

class AgentRuntimeAdapter {
  private agent: Agent;    // open-agent-sdk Agent 实例

  async execute(prompt: string): AsyncGenerator<AgentOutputEvent>;
  async stop(): void;
  async getStatus(): AgentSessionStatus;
}
```

### 4.7 xterm.js 后端 PTY/Session 流协议

```
客户端                     服务端
  │                          │
  ├─ terminal.create ──────→ │ 创建 node-pty 实例
  │                          │ 分配 sessionId
  │ ←──── terminal.output ──┤ PTY stdout → WS 推送
  │                          │
  ├─ terminal.input ───────→ │ 写入 PTY stdin
  │                          │
  ├─ terminal.resize ──────→ │ pty.resize(cols, rows)
  │                          │
  ├─ terminal.close ───────→ │ pty.kill()
  │ ←──── terminal.closed ──┤ 通知关闭
```

### 4.8 Git 服务边界

```typescript
// packages/server/src/adapters/git.ts

class GitAdapter {
  // 本地 Git 操作 (simple-git)
  async status(repoPath: string): Promise<GitStatusResult>;
  async diff(repoPath: string, options?: DiffOptions): Promise<string>;
  async commit(repoPath: string, message: string, files: string[]): Promise<string>;
  async push(repoPath: string, remote?: string, branch?: string): Promise<void>;
  async checkout(repoPath: string, branch: string): Promise<void>;
  async createBranch(repoPath: string, name: string): Promise<void>;

  // 远程 Provider 操作 (post-MVP)
  // GitHub: @octokit/rest
  // GitLab: @gitbeaker/rest
  async createPR(provider: GitProvider, options: PROptions): Promise<string>;
}
```

---

## Phase 5: Frontend Implementation Plan

### 5.1 Next.js App 路由

```
/                           → Workspace 列表页
/workspace/[id]             → 工作空间主界面 (FlexLayout shell)
```

工作空间主界面是单页面应用，所有面板内容通过 FlexLayout tab 切换，不需要路由跳转。

### 5.2 FlexLayout 布局结构

```json
{
  "global": {
    "tabSetConfig": { "enableTabStrip": true },
    "borderSetConfig": { "enableDrop": true }
  },
  "borders": [
    { "type": "border", "location": "bottom", "children": [
      { "type": "tab", "name": "Terminal", "component": "terminal" },
      { "type": "tab", "name": "Git", "component": "git" }
    ]}
  ],
  "layout": {
    "type": "row",
    "children": [
      { "type": "tabset", "weight": 0.3, "children": [
        { "type": "tab", "name": "Channels", "component": "channel-list" },
        { "type": "tab", "name": "Issues", "component": "issue-list" }
      ]},
      { "type": "tabset", "weight": 0.7, "children": [
        { "type": "tab", "name": "Editor", "component": "editor" },
        { "type": "tab", "name": "Chat", "component": "chat" },
        { "type": "tab", "name": "Issue Detail", "component": "issue-detail" }
      ]}
    ]
  }
}
```

**组件映射 (Factory):**
| component | 渲染组件 |
|-----------|----------|
| `channel-list` | `<ChannelList />` |
| `issue-list` | `<IssueList />` |
| `editor` | `<CodeEditor />` + `<FileTree />` |
| `chat` | `<ChatPanel />` |
| `issue-detail` | `<IssueDetail />` |
| `terminal` | `<TerminalPanel />` |
| `git` | `<GitPanel />` |

### 5.3 面板模块设计

#### Channel 聊天
- `<ChannelList />`: 左面板 tab，显示频道列表，点击切换活跃频道
- `<ChatPanel />`: 右面板 tab，消息列表 + 输入框
- 消息通过 WebSocket 实时接收
- @mention 显示 agent 头像和角色标签

#### Issue 中心
- `<IssueList />`: 左面板 tab，按状态分组的 issue 列表
- `<IssueDetail />`: 右面板 tab，issue 详情 + task 列表 + 状态流转
- 状态用颜色标签 (shadcn Badge)

#### Code Editor
- `<FileTree />`: Editor tab 左侧，树形文件浏览器
- `<CodeEditor />`: Editor tab 右侧，Monaco Editor 实例
- `<EditorTabs />`: 多文件 tab 切换
- 文件读写通过 REST API

#### Terminal
- `<TerminalPanel />`: Bottom dock tab
- 多 tab 终端，每个 tab 一个 xterm.js 实例
- `@xterm/addon-fit` 自适应容器大小
- WebSocket 双向数据流
- 拖拽调整大小由 FlexLayout splitter 处理

#### Git 面板
- `<GitPanel />`: Bottom dock tab
- `<DiffViewer />`: Monaco Diff Editor 展示变更
- 文件变更列表 + diff 内容

### 5.4 状态管理 (Zustand)

```typescript
// stores/workspace.ts
interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loadWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, dirs: string[]) => Promise<void>;
  setActiveWorkspace: (id: string) => void;
}

// stores/issue.ts
interface IssueStore {
  issues: Issue[];
  activeIssueId: string | null;
  loadIssues: (workspaceId: string) => Promise<void>;
  createIssue: (title: string, description: string) => Promise<void>;
  setActiveIssue: (id: string) => void;
}

// stores/channel.ts
interface ChannelStore {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>;
  loadChannels: (workspaceId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => void;
  addMessage: (channelId: string, message: Message) => void; // WS 接收
}

// stores/layout.ts
interface LayoutStore {
  layoutJson: string;
  saveLayout: (json: string) => void;
  loadLayout: (workspaceId: string) => Promise<void>;
}

// stores/terminal.ts
interface TerminalStore {
  sessions: Map<string, { id: string; cwd: string }>;
  createSession: (cwd?: string) => void;
  closeSession: (id: string) => void;
}
```

### 5.5 WebSocket 客户端

```typescript
// lib/ws-client.ts
class WSClient {
  private ws: WebSocket;
  private handlers: Map<string, Set<(data: any) => void>>;

  connect(workspaceId: string): void;
  disconnect(): void;
  on(event: string, handler: (data: any) => void): () => void;
  emit(event: string, data: any): void;
}

// 全局单例
export const wsClient = new WSClient();
```

### 5.6 shadcn/ui 组件使用

| 组件 | 用途 |
|------|------|
| `Button` | 操作按钮 |
| `Input` / `Textarea` | 输入框、消息发送 |
| `Dialog` | 创建 workspace/issue/channel 弹窗 |
| `Tabs` | workspace 顶部 tab 切换 |
| `Badge` | issue/task 状态标签 |
| `ScrollArea` | 消息列表、文件树 |
| `DropdownMenu` | 右键菜单 |
| `Toast` | 通知提示 |
| `Card` | issue/task 卡片 |
| `Separator` | 面板分隔 |
| `Avatar` | agent 头像 |
| `Sheet` | 侧边面板 |
| `Tooltip` | 工具提示 |

---

## Phase 6: Risk, Testing, and Delivery Plan

### 6.1 风险清单

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `.agentspace` 写入权限绕过 | Planner-only 规则被破坏 | 后端 service 层强制校验，前端无法直接写入 |
| Agent 执行无限循环 | 资源耗尽 | open-agent-sdk maxTurns 限制 + 超时机制 |
| 文件操作无撤销 | 误操作不可逆 | 提示用户、Git diff 追踪所有变更 |
| open-agent-sdk 版本不稳定 (v0.2) | API 变更导致集成断裂 | 锁定版本，适配器层隔离 |
| node-pty 跨平台问题 | Windows 兼容性 | 测试 Windows/macOS/Linux 三端 |
| WebSocket 断连 | 状态不同步 | 自动重连 + 状态快照恢复 |
| 大文件树加载慢 | UI 卡顿 | 虚拟滚动 + 懒加载目录 |
| 多 agent 并发写同一文件 | 冲突 | 文件锁 + 任务依赖串行化 |
| FlexLayout 状态持久化失败 | 布局丢失 | 默认布局兜底 + JSON 备份 |

### 6.2 测试策略

#### 后端测试
| 层级 | 测试类型 | 工具 |
|------|----------|------|
| 单元测试 | Service 层逻辑、状态机转换、数据校验 | Vitest |
| 集成测试 | REST API 端到端、WebSocket 连接和事件 | Vitest + supertest |
| 持久化测试 | JSON 读写、workspace 目录操作 | Vitest + tmp fixtures |
| Agent 测试 | Agent 编排流程、Hook 触发、超时 | Vitest + mock runtime |

#### 前端测试
| 层级 | 测试类型 | 工具 |
|------|----------|------|
| 组件测试 | UI 渲染、交互 | Vitest + Testing Library |
| Store 测试 | Zustand store 逻辑 | Vitest |
| E2E 测试 | 关键用户流程 | Playwright |

#### 端到端测试场景
1. 创建 workspace → 绑定目录 → 看到 .agentspace 初始化
2. 创建 issue → agent 自动规划 → 看到任务分解
3. Agent 执行 → 终端显示输出 → 文件树更新 → diff 可见
4. Agent 审核通过 → channel 收到通知

### 6.3 交付清单

#### M1 交付物
- [x] pnpm monorepo 结构
- [x] Next.js + Express 可运行
- [x] FlexLayout 基础 shell
- [x] 基础路由

#### M2 交付物
- [x] Workspace CRUD
- [x] 文件树 + Monaco Editor
- [x] .agentspace 初始化

#### M3 交付物
- [x] WebSocket 连接
- [x] xterm.js 终端
- [x] 多终端 tab

#### M4 交付物
- [x] Channel CRUD + Message
- [x] WebSocket 实时消息

#### M5 交付物
- [x] Agent 完整生命周期
- [x] Scheduler + Planner + Executor + Reviewer
- [x] Hook 系统

#### M6 交付物
- [x] Issue + Task CRUD
- [x] 状态机实现
- [x] UI 面板

#### M7 交付物
- [x] Git diff 面板
- [x] 端到端测试通过

### 6.4 未解决问题 (需产品决策)

1. **Agent 执行模式**: MVP 使用 open-agent-sdk 进程内执行，还是 spawn CLI 子进程？
   → 建议: 进程内执行，open-agent-sdk 直接集成

2. **Git Provider 认证**: PAT token 还是 OAuth？
   → 建议: PAT token (最简单，用户在设置中配置)

3. **前端文件操作限制**: 前端是否可以不受限修改任何文件？
   → 建议: 前端可自由操作，限制仅对 automated agent 生效

4. **终端会话管理**: 后端进程内 PTY 还是外部 terminal multiplexer？
   → 建议: node-pty 进程内管理，简单可靠

5. **VSCode 调试面板替代方案**: post-MVP 如何实现？
   → 建议: 调研 Chrome DevTools Protocol 或自建简化版代码检查面板
