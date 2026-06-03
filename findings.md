# Findings & Decisions: WorkFox 迁移

## 需求摘要

- 将 work_fox 的工作流系统完整迁移到 agent-spaces
- 前端：Vue → React 转换
- 后端：合并到 Express 服务
- 产品级统一：WorkFox Workflow 作为 canonical workflow，agent-spaces 现有 agent/command workflow 通过 adapter/migration 纳入统一模型
- 不保留长期并行的两套 Workflow 产品入口
- shadcn 通用 UI 组件不需要迁移
- Electron 部分忽略

## 2026-06-04 补充发现：便签 customView 渲染缺口

- 用户指出 `packages/web/src/lib/workflow-nodes.ts` 的 `sticky_note` 未使用 WorkFox 自定义视图渲染便签内容。
- 参考文件 `/Users/Zhuanz/Documents/work_fox/src/lib/workflow/nodes/display.ts` 中 `sticky_note` 定义包含 `customView: StickyNoteView` 和 `customViewMinSize: { width: 180, height: 120 }`。
- 当前 agent-spaces shared 类型 `NodeTypeDefinition` 已有 `customView?: unknown` 与 `customViewMinSize` 字段。
- 当前 `WorkflowNode` 只消费了 `customViewMinSize`，没有渲染 `definition.customView`。
- WorkFox `StickyNoteView.vue` 的行为是节点内 textarea 编辑 `data.content`，并阻止拖拽/画布平移事件。
- agent-spaces 当前 editor 已有 `handleNodeDataUpdate`，但 canvas 尚未监听节点内发出的 `workflow:update-node-data` 事件。

## 2026-06-04 补充发现：ExecutionBar 点击执行不发请求

- React `packages/web/src/components/workflow/workflow-execution-bar.tsx` 的执行按钮只调用父组件 `onExecute`。
- 父组件 `workflow-editor.tsx` 中 `handleExecute` 目前只有 `setExecStatus('running')` 和占位注释，没有调用 `getWS().send()` 或 REST API。
- `packages/web/src/lib/workflow-api.ts` 的 `workflowApi.execute()` 也只是返回 `{ event, data }` 描述，并不会发送请求。
- WorkFox `ExecutionBar.vue` 点击执行会调用 `store.startExecution(...)`；迁移到 React 后需要把这个路径接到现有 `workflow:execute` WS channel。
- 后端 `registerExecutionChannels()` 已注册 `workflow:execute`，但当前未给 `executionManager.execute()` 传 `eventSink`，执行过程事件会走全局 emit；从发起连接直接回传更可靠。

## 2026-06-04 补充发现：ExecutionBar 复刻范围

- React 版 `workflow-execution-bar.tsx` 已从简化单行列表改为 WorkFox 风格：控制栏 + 展开后左右分栏。
- 已复刻控制区：开始节点下拉、开始输入弹层、暂停/继续/停止、验证错误、进度、耗时、状态 badge。
- 已复刻历史区：执行历史列表、状态图标、选择日志、删除单条日志、清空历史。
- 已复刻详情区：横向步骤卡片、步骤状态、节点类型、耗时、错误复制、节点信息复制、输入/输出/日志 tabs。
- 等价替代：WorkFox 使用 `Sheet` + preset API + `JsonEditor` + virtual scroller；agent-spaces 当前没有这些对应依赖/组件，本次用 `Dialog`、格式化 JSON 文本和普通横向滚动替代，不新增依赖。

## 2026-06-04 补充发现：ExecutionBar ResizablePanel 尺寸单位

- `docs/ui/react-resizable-panels-size-units.md` 说明：`ResizablePanel` 的数字 `defaultSize/minSize/maxSize` 在当前版本表示 px，不是百分比。
- `workflow-execution-bar.tsx` 之前使用 `defaultSize={25}` / `minSize={15}` / `maxSize={40}`，会导致内部分栏尺寸异常。
- 执行栏根节点使用 `h-full`，放在 workflow canvas 的 `flex-col` 下方时会占满整个可用高度，挤压画布。
- 修复：内部 panel 改为 `"25%"` / `"15%"` / `"40%"` / `"75%"` / `"40%"` 字符串，并添加稳定 id；执行栏根节点改为展开时 `h-[320px] max-h-[45vh]`，折叠时 `h-auto`。

## 2026-06-04 补充发现：插件对话框与 Workflow 插件节点

- 用户指出缺少 WorkFox 的 `PluginsDialog.vue` 和 `NodeSidebar.vue` 中“添加插件到 workflow”的能力。
- agent-spaces 迁移后已有 shared 插件类型、Workflow 的 `enabledPlugins` / `pluginConfigSchemes` 字段、`workflow-nodes.ts` 的 `registerPluginNodeDefinitions()`，但没有 React 插件 UI、插件 REST API 或 workflow plugin scheme REST endpoint。
- WorkFox 的插件系统包含 Electron/local/web CDN 多 runtime；agent-spaces 当前实现先落地本地 data-dir 插件能力，避免迁入 Electron 相关路径。
- 新 server 插件服务读取 `${AGENT_SPACES_DATA_DIR || ~/.agent-spaces-data}/plugins/<pluginId>/plugin.json|manifest.json|package.json`，支持 manifest 内 `workflowNodes` 或 `entries.workflow` 指向的 JSON 节点定义。
- 新 React `WorkflowPluginsDialog` 负责浏览 workflow 插件、添加/移除到当前 workflow；`WorkflowNodeSidebar` 监听 `workflow.enabledPlugins`，加载插件节点并注册到节点定义 registry。
- 新 `WorkflowPluginConfigDialog` 支持插件默认配置与 workflow-specific scheme 配置；sidebar 插件分类 header 支持选择、创建、删除配置方案。
- 发现并修复 workflow route 顺序问题：`/folders`、`/execution-logs/all`、`/validate-cron` 需要声明在 `/:workflowId` 前面。

## 研究发现

### work_fox 项目架构

- **框架**: Vue 3 + Pinia + Vue Router + Vue Flow + Tailwind CSS
- **后端**: Express 5 + WebSocket (ws) + node-cron
- **共享层**: 独立 shared 目录（类型/协议/工具函数）
- **数据存储**: JSON 文件持久化（与 agent-spaces 类似）
- **Electron**: electron-vite 打包，有独立 preload/main 进程（忽略）

### 核心功能模块

1. **工作流可视化编辑器** — 基于 Vue Flow 的 DAG 编辑器，是 work_fox 的核心
   - 拖拽式节点/边编辑
   - 嵌入式子工作流（EmbeddedWorkflowEditor）
   - 复合节点（Loop 等）
   - 分组节点（GroupNode）
   - 便签节点（StickyNote）
   - 变量选择器
   - 节点暂存区
   - 对齐辅助线
   - 自动布局（dagre）
   - 版本控制 / 操作历史 / 撤销重做

2. **AI Chat 对话** — 多会话管理 + 流式输出 + 工具调用展示
   - Tiptap 富文本输入（含 @mention）
   - 工具调用卡片（ToolCallCard）
   - Thinking blocks 展示
   - 会话管理器
   - 工作区文件树
   - Agent 流式请求管理

3. **Dashboard 仪表盘** — 统计概览 + 执行历史 + 工作流详情
   - @unovis 数据可视化（执行趋势图）
   - 分页执行历史表格
   - 工作流版本列表

4. **插件系统** — 三路聚合（backend/Electron/Web CDN）
   - 节点注册表
   - 工具发现系统
   - 插件配置管理

5. **设置管理** — AI Provider / 快捷键 / 主题 / Agent 设置

6. **触发器系统** — Cron 定时 + Webhook Hook 触发

7. **命令面板** — 全局命令搜索

### 关键依赖映射

#### 已在 agent-spaces 中存在可直接复用的

| work_fox 依赖 | agent-spaces 对应 |
|---------------|------------------|
| @vue-flow/core | @xyflow/react（已安装） |
| @dagrejs/dagre | @dagrejs/dagre（已安装） |
| Tiptap | TipTap React（已安装） |
| shadcn-vue | shadcn/ui（已安装） |
| pinia | zustand（已安装） |
| tailwindcss | tailwindcss 4（已安装） |
| shiki | 可直接用（通用库） |
| zod | zod 4（已安装） |
| express 5 | express 5（已安装） |
| ws | ws（已安装） |
| monaco-editor | monaco-editor（已安装） |
| @tanstack/vue-table | @tanstack/react-table（已安装） |
| golden-layout | flexlayout-react（已安装，用户确认） |
| vue-stream-markdown | react-markdown（已安装）+ 自定义流式渲染 |
| vue3-emoji-picker | emoji-picker-react（已安装） |
| @unovis/vue | recharts（已安装）优先，必要时再评估 @unovis/react |

#### 需要新增的依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| dexie | IndexedDB | 通用库，框架无关 |
| node-cron | Cron 调度 | 后端依赖 |
| cron-parser | Cron 解析 | 后端依赖 |
| eventemitter2 | 事件系统 | 通用库 |
| lightgallery | 图片画廊 | 需找 react 替代 |
| katex | 数学公式渲染 | 需确认当前 web 是否已安装 |

### 后端架构对比

| 方面 | work_fox | agent-spaces |
|------|----------|-------------|
| HTTP 框架 | Express 5 | Express 5 |
| WebSocket | ws（自建 WSRouter） | ws（已有） |
| 数据存储 | JSON 文件 | JSON + SQLite |
| 认证 | sessionToken | Bearer Token |
| 插件系统 | BackendPluginRegistry | 无对应 |
| 工作流引擎 | ExecutionManager（独立） | Workflow 系统（DAG 不同实现） |
| Chat 运行时 | ChatRuntime (Claude Agent SDK) | ClaudeCodeRuntime (Claude Agent SDK) |

### 技术风险

1. **golden-layout** — Vue 组件封装需转为 React，考虑用 FlexLayout 替代或寻找 golden-layout React wrapper
2. **Vue Flow → @xyflow/react** — API 相似但有差异，节点/边的 props 类型不同
3. **路由差异** — Vue Router hash 模式 vs Next.js App Router，页面组织方式完全不同
4. **工厂模式 stores** — work_fox 的 createWorkflowStore(tabId) 为每个标签页创建独立 store，React 中需用 Context + useRef 或 zustand 的 store factory 模式实现
5. **wsBridge 通信层** — work_fox 的 wsBridge 与 agent-spaces 的 WebSocket 系统需整合或并存

## 技术决策

| 决策 | 理由 |
|------|------|
| golden-layout → FlexLayout | 用户确认 |
| 路由 → 合并到现有路由 | 用户确认 |
| shared → 合并到 packages/shared | 用户确认 |
| 文件组织 → 按功能分散到现有目录 | 用户确认 |
| WorkFox Workflow 作为 canonical workflow | 用户确认要产品级统一，前期避免“共存/替换/适配”歧义 |
| agent-spaces 旧 WorkflowTemplate 通过 adapter/migration 纳入统一模型 | 避免现有 agent/command workflow 数据和页面在替换期间失效 |
| 不保留长期 workfox-* 子系统入口 | 迁移期可临时命名隔离，但最终用户入口/API/存储语义收敛到一套 Workflow |

### 关键发现：Workflow 系统差异巨大

**agent-spaces Workflow**（简单）：
- 2 种节点：agent + command
- 用途：Issue 自动化编排（DAG 模板 → Task 映射）
- Store：简单 CRUD（fetch/create/update/delete）
- 编辑器：基础 DAG 编辑（9 个组件文件）
- Shared 类型：WorkflowTemplate（4 字段）

**work_fox Workflow**（复杂）：
- 10+ 节点类型：start/end/run_code/toast/switch/agent_run/gallery_preview/alert/prompt/form/loop/loop_body/sticky_note/group/sub_workflow
- 用途：完整工作流自动化平台（执行引擎 + 触发器 + 插件 + 交互）
- Store：工厂模式 + 12 子模块（crud/edit/execution/debug/group/ai/staging/version/undo-redo/dirty-tracker/execution-log/utils）
- 编辑器：全功能（属性面板/版本控制/操作历史/撤销重做/暂存区/触发器/嵌入式子工作流/对齐辅助线/分组管理）
- Shared 类型：15 文件（完整协议/类型/工具函数）

## Phase 3 类型差异分析

### agent-spaces legacy WorkflowTemplate vs work_fox Workflow

| 维度 | agent-spaces (legacy) | work_fox (canonical) |
|------|----------------------|---------------------|
| **主模型** | `WorkflowTemplate` | `Workflow` |
| **节点类型** | 2 种：`agent` / `command`（union type） | 10+ 种：`string` 类型字段，data 驱动 |
| **节点数据** | 紧耦合（agent 有 agentConfigId/role/modelId；command 有 script/cwd/env/shell） | 松耦合（`Record<string, unknown>`） |
| **边** | `{ id, source, target }` | `{ id, source, target, sourceHandle?, targetHandle?, composite? }` |
| **分组** | 无 | `WorkflowGroup[]`（嵌套、颜色、锁定、禁用） |
| **触发器** | 无 | `WorkflowTrigger[]`（cron/hook discriminated union） |
| **文件夹** | 无 | `WorkflowFolder`（树形） |
| **版本** | 无 | `WorkflowVersion`（快照） |
| **执行日志** | 无 | `ExecutionLog` + `ExecutionStep[]`（完整执行追踪） |
| **插件** | 无 | `enabledPlugins[]` + `pluginConfigSchemes` + `PluginMeta/PluginInfo` |
| **Agent 配置** | 节点内联（agentConfigId） | `WorkflowAgentConfig`（workspaceDir/dataDir/skills/mcps） |
| **时间戳** | `string` (ISO) | `number` (epoch ms) |
| **viewport** | `viewport?: { x, y, zoom }` | `layoutSnapshot?: Record<string, unknown>` |
| **标签/图标** | 无 | `icon?`, `tags?[]`, `description?` |
| **WS 契约** | 简单事件（workflow.created/updated/deleted） | 完整 channel system（BackendChannelMap 100+ channels） |
| **执行事件** | 无 | `ExecutionEventMap`（11 种事件，含 node:start/progress/complete/error） |
| **交互系统** | 无 | `InteractionRequest/Response`（file_select/form/confirm/agent_chat 等） |
| **操作历史** | 无 | `OperationEntry[]`（含 snapshot） |
| **暂存区** | 无 | `StagedNode[]` |
| **错误** | 无统一错误码 | `BackendErrorCode`（16 种错误码） |
| **复合节点** | 无 | `CompoundNodeDefinition` + composite meta（loop/group 等） |

### Legacy Adapter 映射策略

1. **agent 节点** → `agent_run` 节点类型
   - `agentConfigId` → data.agentConfigId
   - `role` → data.role
   - `modelId` → data.modelId
   - `taskTitleTemplate` / `taskDescriptionTemplate` → data.taskTitleTemplate / data.taskDescriptionTemplate
   - `avatarUrl` → node.nodeColor 或忽略

2. **command 节点** → `run_code` 节点类型
   - `script` → data.code
   - `cwd` → data.cwd
   - `env` → data.env
   - `shell` → data.shell
   - `failStrategy` → 无直接映射，可忽略或映射为 data.failStrategy

3. **WorkflowTemplate → Workflow**
   - `id` → `id`
   - `name` → `name`
   - `description` → `description`
   - `nodes` → 遍历适配每个节点
   - `edges` → 补充 sourceHandle/targetHandle 默认 null
   - `viewport` → 丢弃（WorkFox 用 layoutSnapshot）
   - `createdAt: string` → `createdAt: number`（Date.parse）
   - `updatedAt: string` → `updatedAt: number`（Date.parse）
   - 新增字段默认值：`folderId: null`, `groups: []`, `triggers: []`

### 统一 shared 文件规划

| 文件 | 内容 | 来源 |
|------|------|------|
| `types/workflow.ts` | 重写：主 Workflow/Node/Edge + Legacy adapter + re-export | work_fox workflow-types.ts 为主 |
| `types/workflow-execution.ts` | 新增：ExecutionLog/Step/Event/Control/Debug | work_fox execution-events.ts |
| `types/workflow-plugin.ts` | 新增：PluginMeta/PluginInfo/PluginConfig/PluginTool | work_fox plugin-types.ts + plugin-entry.ts + plugin-capability-loader.ts |
| `types/workflow-channel.ts` | 新增：WS Channel 契约 | work_fox channel-contracts.ts（精简版，去掉非 workflow 相关 channel） |
| `types/workflow-composite.ts` | 新增：复合节点工具函数 | work_fox workflow-composite.ts + embedded-workflow.ts + workflow-local-bridge.ts |
| `types/workflow-errors.ts` | 新增：统一错误码 | work_fox errors.ts |
| `types/workflow-shortcut.ts` | 新增：快捷键类型 | work_fox shortcut-types.ts（精简版） |

### 关键设计决策

1. **Node type 改为 string**：不再用 discriminated union（`agent | command`），改为 `string` 类型 + `data: Record<string, unknown>`，与 work_fox 对齐
2. **保留 Legacy 命名**：`WorkflowTemplate` 作为 type alias 指向 `Workflow`，保持向后兼容
3. **时间戳统一为 number**：work_fox 用 epoch ms，统一后 agent-spaces 的 ISO string 通过 adapter 转换
4. **Plugin 系统可选**：统一类型中 plugin 相关字段全部 optional，agent-spaces 不使用插件时无影响
5. **WS Channel 精简**：只迁移 workflow 相关的 channel（workflow:* / workflowFolder:* / workflowVersion:* / executionLog:* / executionPreset:* / staging:* / trigger:*），不迁移 chat/aiProvider/shortcut/fs 等 agent-spaces 已有的
6. **composite 函数保留**：loop/group 等复合节点的工具函数直接搬入 shared（纯函数无副作用）

## 问题追踪

| 问题 | 状态 | 解决方案 |
|------|------|---------|
| golden-layout React 替代方案 | 已定 | 使用 flexlayout-react |
| 路由挂载策略 | 已定 | `/workflows` 作为统一 Workflow 产品入口 |
| shared 层合并方式 | 已定 | WorkFox 模型为主，legacy WorkflowTemplate 通过 adapter/migration 兼容 |
| 数据存储策略 | 已定 | 统一 Workflow 存储；保留旧数据读取和迁移路径 |
| 旧 workflow 数据迁移细节 | 已设计 | 字段映射见上表，timestamps 转 epoch ms，viewport 丢弃，新增字段给默认值 |
| agent/command 节点映射 | 已设计 | agent→agent_run + command→run_code，数据平铺到 Record<string, unknown> |
| Node type 设计 | 已定 | 改为 string + data: Record<string, unknown>，与 work_fox 对齐 |
| 时间戳格式 | 已定 | 统一为 number (epoch ms)，legacy ISO string 通过 adapter 转换 |
| WS Channel 范围 | 已定 | 仅迁移 workflow 相关 channel，不迁移 agent-spaces 已有的 |

## 2026-06-03 补充发现：NodeProperties 未完全迁移

- React `workflow-properties-panel.tsx` 原实现只覆盖基础 text/textarea/number/select/code/conditions，且 `output_fields` 被错误当作 `string[]` 编辑；shared 实际类型是 `OutputField[]`。
- WorkFox `NodeProperties.vue` 还包含输入字段、输出字段、JSON 预设、输出 JSON 导入、延迟执行 `_delay`、循环体节点空状态、属性可见性和结构化 array 字段编辑。
- 本次补齐后 React 面板支持：
  - `checkbox`、`array`、`output_fields`、`conditions`
  - `visibleWhen`、`default`、`readonly`
  - `inputFields` / `outputs` 结构化编辑
  - JSON 预设新增/编辑/删除/选择/复制，以及将预设 outputs 应用为输出字段
  - 粘贴 JSON 自动推断 `OutputField[]`
  - 节点 `_delay` 配置
- 2026-06-04 补充：已接入 Vue 版“测试脚本/局部测试”能力。React `WorkflowEditor` 使用 `workflow:debug-node` WS channel 发送当前编辑器未保存的 nodes/edges/groups snapshot，`WorkflowPropertiesPanel` 显示测试按钮、运行中状态、成功/失败结果、JSON 输出和“应用测试输出”。
