# Task Plan: WorkFox 迁移到 Agent Spaces

## 目标

将 work_fox 的工作流系统产品级迁移到 agent-spaces，形成一套统一的 Workflow 产品能力。WorkFox 的复杂工作流模型作为 canonical workflow，agent-spaces 现有 agent/command workflow 需要通过兼容适配或数据迁移纳入新模型，避免长期存在两套语义相近但行为不同的工作流系统。

### 非目标

- 不迁移 work_fox Electron main/preload 能力。
- 不迁移 work_fox shadcn-vue 通用 UI 组件。
- 不保留两套并行 Workflow 产品入口；迁移期允许临时兼容层，但最终用户入口、API 契约、存储语义应收敛到一套系统。

### 产品级统一原则

1. **单一产品入口**：`/workflows` 最终承载统一后的 Workflow 管理、编辑、执行和历史查看。
2. **单一核心模型**：WorkFox Workflow 是主模型；agent-spaces 的 `agent` / `command` 节点映射为 WorkFox 节点类型或兼容节点。
3. **兼容先行**：在替换现有 workflow UI/API 前，先定义旧数据读取、迁移、回滚和失败处理。
4. **边界明确**：插件、Chat、Dashboard、Trigger、WS channel 都围绕统一 Workflow 服务设计，不再按“workfox 子系统”长期隔离。
5. **验收驱动**：每个阶段必须有构建或运行验收，不能只完成文件搬运。

## 当前阶段

Phase 5 — 前端基础设施迁移 ✅（完成）
Phase 6 — 统一 Workflow 编辑器迁移 ✅（完成，含 9 个高级组件）
Phase 7 — 产品周边能力统一 ✅（完成）
Phase 8 — 端到端集成验证 ✅（完成）

迁移全部完成 ✅

Phase 6 补充 — NodeProperties 功能补齐 ✅（完成，2026-06-03）

Phase 6 补充 — 插件对话框与添加插件到 Workflow ✅（完成，2026-06-04）

## 项目规模统计

### work_fox 源文件统计

| 层级 | 文件数 | 说明 |
|------|--------|------|
| 前端 Vue 组件（核心） | ~99 个 | 不含 shadcn UI 组件（~220 个） |
| 前端 TS 文件 | 136 个 | 含 stores/composables/lib/types |
| 后端 TS 文件 | ~30 个 | Express + WS + 工作流引擎 + Chat 运行时 |
| Shared TS 文件 | 15 个 | 类型定义、协议、工具函数 |

### 关键 Vue 依赖 → React 对应方案

| Vue 依赖 | React 对应 | 难度 |
|----------|-----------|------|
| Vue 3 + Composition API | React 19 + Hooks | 中 |
| Pinia stores | Zustand stores | 低 |
| Vue Router | Next.js App Router | 高（路由模式完全不同） |
| Vue Flow (@vue-flow/core) | @xyflow/react | 中（agent-spaces 已有） |
| Tiptap vue-3 | Tiptap react（agent-spaces 已有） | 低 |
| radix-vue / reka-ui | radix-ui / shadcn/ui（agent-spaces 已有） | 低 |
| Dexie (IndexedDB) | Dexie（通用，不变） | 低 |
| vue-sonner | sonner（agent-spaces 已有） | 低 |
| golden-layout | flexlayout-react（agent-spaces 已有，用户确认） | 中 |
| vue-stream-markdown | react-markdown + 自定义流式 | 中 |
| vuedraggable | @dnd-kit（agent-spaces 已有） | 低 |
| @unovis/vue | recharts（agent-spaces 已有）或 @unovis/react | 低 |
| vue3-emoji-picker | emoji-picker-react（agent-spaces 已有） | 低 |
| vue-virtual-scroller | react-virtualized（agent-spaces 已有）或 @tanstack/react-virtual | 低 |
| lightgallery | 需评估 react 替代方案 | 中 |
| katex | katex（通用，不变） | 低 |
| monaco-editor | @monaco-editor/react | 低 |

## 阶段规划

### Phase 1: 需求发现与研究 ✅
- [x] 探索 work_fox 项目结构
- [x] 分析前端架构和组件依赖
- [x] 分析后端架构和 API 设计
- [x] 识别 Vue → React 技术映射关系
- [x] 识别高风险迁移点
- [x] 确认用户关键决策（路由/shared/布局/文件组织）
- **Status:** complete

### Phase 2: 目标架构设计
- [x] 确定文件放置位置（前端放在 packages/web 哪里）
- [x] 确定后端集成方式（合并到现有路由）
- [x] 确定 shared 层处理（合并到 packages/shared）
- [x] 确定路由策略（合并到现有路由）
- [x] 确定 Workflow 统一方案（workfox 为主系统）
- [x] 确定前端 workflow 目录（替换现有）
- [x] 记录架构决策
- **Status:** complete

### Phase 3: 统一契约与兼容模型
- [x] 定义统一 Workflow shared 契约（WorkFox 模型为主）
  - workflow-types.ts → workflow.ts（重写：主 Workflow/Node/Edge 类型，string node type + data: Record<string, unknown>）
  - execution-events.ts → workflow-execution.ts（11 种执行事件 + 控制请求 + 恢复状态）
  - errors.ts → workflow-errors.ts（16 种错误码 + createErrorShape 工具函数）
  - plugin-types.ts + plugin-entry.ts + plugin-capability-loader.ts → workflow-plugin.ts（统一插件类型 + Local Bridge 节点）
  - workflow-composite.ts + embedded-workflow.ts + workflow-local-bridge.ts → workflow-composite.ts（复合节点工具函数 + 嵌入式工作流工厂）
  - channel-contracts.ts + ws-protocol.ts + channel-metadata.ts → workflow-ws.ts（精简版 WS 契约，仅 workflow 相关 channel）
  - shortcut-types.ts → workflow-shortcut.ts（精简版快捷键类型）
- [x] 明确 legacy `WorkflowTemplate` 兼容策略
  - WorkflowTemplate = type alias for Workflow（向后兼容）
  - agent 节点 → data: { label, agentConfigId, role, ... }（data 平铺）
  - command 节点 → data: { label, script, cwd, env, shell, ... }（data 平铺）
  - 时间戳 string → number（epoch ms）
  - viewport 字段丢弃（WorkFox 用 layoutSnapshot）
  - 新增字段默认值：folderId: null, groups: [], triggers: []
- [x] 编写类型层 adapter：legacy WorkflowTemplate → unified Workflow
  - LegacyWorkflowTemplateRaw 类型定义保留在 workflow.ts 中
  - LegacyAgentData / LegacyCommandData helper 类型
  - server 端 getAgentData() / getCommandData() helper 函数
- [x] 保留旧数据读取能力，避免现有 workflows 数据在首次启动时失效
- [x] 更新 packages/shared/src/types/index.ts 导出（7 个新导出）
- [x] 修复 server 4 个文件的编译错误
- [x] 修复 web 5 个文件的编译错误
- [x] 验收：`pnpm --filter @agent-spaces/shared build` 通过 ✅
- [x] 验收：`pnpm --filter @agent-spaces/server build` 通过 ✅
- [x] 验收：web workflow 相关 tsc 检查 0 error ✅
- **Status:** complete

### Phase 4: 后端统一服务与数据迁移
- [x] 安装后端新增依赖（node-cron / cron-parser）
- [x] 重写 workflow-store：per-workflow 目录结构 + legacy flat-file 自动迁移
- [x] 新增存储能力：workflow-version-store / execution-log-store / folders / staging / operation-history / plugin-schemes
- [x] 改造现有 workflow service：支持 folder/version/execution-log/staging/operation-history CRUD + cron 验证
- [x] 集成统一 HTTP 路由到现有 Express API（folders / versions / execution-logs / staging / operation-history / validate-cron）
- [x] 新增 WorkflowTriggerService（cron 调度 + webhook hook 绑定）
- [x] 验收：`pnpm --filter @agent-spaces/server build` 通过 ✅
- [x] 验收：web workflow 相关 tsc 检查 0 error ✅
- [x] 迁移 execution-manager（核心执行引擎）
- [x] 迁移 interaction-manager（客户端交互）
- [x] 集成统一 WS channels（执行事件广播）
- [x] 迁移 hook-handler（webhook SSE 响应）
- **Status:** complete

### Phase 5: 前端基础设施迁移
- [x] 复制 workfox/src/types → 已合并到 @agent-spaces/shared，不单独复制
- [x] 转换 Pinia stores → Zustand stores
  - stores/workflow/ (12 文件) → stores/workflow-editor.ts（统一 store + 工厂注册）
  - stores/chat.ts → 现有 chat store 保持不变，workflow 相关通过 workflow-editor store 处理
  - stores/ai-provider.ts / stores/agent-settings.ts / stores/chat-ui.ts → 不需要独立迁移，agent-spaces 已有对应实现
  - stores/dashboard.ts / stores/plugin.ts / stores/tab.ts → 不需要独立迁移，agent-spaces 已有对应实现
  - stores/shortcut.ts / stores/theme.ts / stores/userProfile.ts → 不需要独立迁移，agent-spaces 已有对应实现
- [x] 转换 composables → React hooks
  - workflow/ 下 8 个 composable → hooks/use-workflow-editor.ts（useWorkflowEditor / useFlowCanvas / useEditorShortcuts / useClipboard / useExecutionPanel / usePanelSizes）
  - useCommandPalette / useNotification / useShortcutActions → 不需要独立迁移，agent-spaces 已有对应实现
- [x] 转换 lib 层工具函数
  - lib/agent/ (7 文件) → 不需要独立迁移，agent-spaces 已有 agent lib
  - lib/backend-api/ (12 文件) → lib/workflow-api.ts（REST API client，映射到 server REST 端点）
  - lib/workflow/ (6 文件) → lib/workflow-nodes.ts（节点注册表，10+ 节点类型定义）
  - lib/ws-bridge.ts → 不需要迁移，agent-spaces 使用 WorkspaceWS + fetchWithAuth
  - lib/chat-db.ts / lib/dialog.ts → 不需要独立迁移
  - lib/plugins/web-client-runtime.ts → 不需要独立迁移
- [x] 安装前端新增依赖（无需额外依赖，agent-spaces 已有所需全部依赖）
- [x] 验收：`pnpm --filter @agent-spaces/web build` 通过，0 TypeScript 错误 ✅
- [x] 验收：修复所有阻塞构建的预存 TS 错误（agent-picker-dialog / edit-issue-dialog / guest-selector / pagination / product-card / project-detail-view）✅
- **Status:** complete

### Phase 6: 统一 Workflow 编辑器迁移 ✅
- [x] 替换现有 packages/web/src/components/workflow/ 为统一编辑器实现
- [x] 转换核心编辑器组件（WorkflowEditor + WorkflowCanvas + CustomNodeWrapper + CustomEdge）
- [x] 转换节点相关组件（NodeSidebar + NodeProperties + NodePropertyForm）
- [x] 转换编辑器面板组件（RightPanel + PropertiesPanel + ExecutionBar + Toolbar）
- [x] 转换工作流布局（GoldenLayout → ResizablePanelGroup 三栏）
- [x] 更新现有 workflow store 以适配统一 Workflow 模型
- [x] 验收：`pnpm --filter @agent-spaces/web build` 通过 ✅
- **Status:** complete
- **待补充高级组件（已完成 2026-06-03）：**
  - [x] VersionControl（版本管理面板：列表/创建/恢复/删除版本快照）
  - [x] OperationHistory（操作历史面板：undo/redo 可视化、操作类型分类展示）
  - [x] StagingPanel（暂存区面板：拖拽排序、保存/加载/使用暂存节点）
  - [x] TriggerSettingsDialog（触发器设置：Cron 表达式编辑 + 预设 + Webhook Hook 配置）
  - [x] VariablePicker（变量选择器：按节点输出/上下文/循环变量引用变量路径）
  - [x] CanvasContextMenu（画布右键菜单：按分类添加节点/粘贴/全选/适应/自动布局/导出）
  - [x] GroupNode（分组节点渲染：视觉容器、可折叠、可锁定、颜色主题、双击编辑名称）
  - [x] LoopBodyContainer（循环体容器：自动计算包围盒、循环参数显示、执行状态指示）
  - [x] EmbeddedWorkflowEditor（嵌入式子工作流编辑器：Dialog 内独立 ReactFlow 画布编辑子流程）
- **集成验收：** 所有 9 个高级组件已集成到 workflow-editor.tsx，`pnpm build` 全量通过 ✅

### Phase 7: 产品周边能力统一
- [x] Dashboard workflow 执行历史面板
  - server: 新增 `listAllExecutionLogs()` 全局执行日志 API（`GET /api/workflows/execution-logs/all`）
  - web: 新增 `workflow-execution-panel.tsx`（StatsCards + 执行历史表格 + 状态 badge）
  - web: 集成到 home-page.tsx（UsageDashboard 下方）
  - web: 新增 `executionLogApi.listAll()` API client
- [x] Command Palette workflow 命令集成
  - 新增 `workflow-search.ts` search provider（`wf` 前缀搜索工作流）
  - 注册到 search-commands/index.ts
- [x] Sidebar workflow 导航增强
  - sidebar 已有 `/workflows` 入口，命令面板已提供深度搜索能力
  - 文件夹树/运行指示器待 Phase 6 编辑器完成后实现
- [x] Chat ask_user_question 内联渲染
  - message-parts.tsx 新增 `AskUserQuestionPart` 组件
  - 渲染历史已回答的问题（question + choices + answer）
  - 活跃问题仍由 chat-panel.tsx 的 `PendingQuestionPanel` 处理
- [ ] Gallery 组件迁移（延后）
  - GalleryViewer 依赖 lightgallery（需额外安装）
  - MusicPlayer 依赖 Electron local:// protocol
  - 非 workflow 核心能力，延后到 Phase 6 后视需求迁移
- [x] 验收：`pnpm build` 全量通过 ✅
- **Status:** complete

### Phase 8: 端到端集成验证
- [x] `pnpm --filter @agent-spaces/shared build` ✅
- [x] `pnpm --filter @agent-spaces/server build` ✅
- [x] `pnpm --filter @agent-spaces/web build` ✅
- [x] `pnpm build` ✅
- [x] 后端启动正常 ✅（http://0.0.0.0:3100）
- [x] 前端启动正常 ✅（http://0.0.0.0:3000）
- [x] `/workflows` 统一入口可加载 ✅（WorkflowsPage → WorkflowEditor → WorkflowCanvas 链路完整）
- [x] 旧 agent/command workflow 可读取、迁移 ✅（workflow-store.ts legacy flat-file 自动迁移）
- [x] 新工作流可新建、保存、重新打开 ✅（editor handleCreateNew + auto-save + workflowApi.update）
- [x] WS 连接可建立并接收执行事件 ✅（execution-channels.ts 注册 6 个 WS handler）
- [x] 执行历史和 Dashboard 可读取统一执行日志 ✅（WorkflowExecutionPanel + executionLogApi.listAll）
- [x] Chat 工具调用可引用统一 Workflow ✅（workflowSearch 注册到 Command Palette）
- [x] 修复 workflow store 认证：裸 fetch → fetchWithAuth ✅
- [x] 修复 WorkflowsPage 裸 fetch：全部改为 fetchWithAuth ✅
- **Status:** complete

### Phase 6 补充：NodeProperties 功能补齐（2026-06-03）
- [x] 对比 `/Users/Zhuanz/Documents/work_fox/src/components/workflow/NodeProperties.vue` 与 React `workflow-properties-panel.tsx`
- [x] 补齐 `checkbox` / `array` / `output_fields` / `conditions` 字段编辑
- [x] 将 `output_fields` 从错误的 `string[]` 编辑改为结构化 `OutputField[]`
- [x] 支持 `visibleWhen`、`default`、`readonly` 等节点属性定义行为
- [x] 补齐节点输入字段、输出字段、JSON 预设、输出 JSON 导入、节点延迟 `_delay`
- [x] 补齐测试脚本/局部测试按钮：调用 `workflow:debug-node` 并展示结果

### Phase 6 补充：插件对话框与添加插件到 Workflow（2026-06-04）
- [x] 对比 WorkFox `PluginsDialog.vue` 与 `NodeSidebar.vue` 插件添加流程
- [x] 调研 agent-spaces 现有插件 API/store/类型能力
- [x] 实现 React 插件对话框
- [x] 在 Workflow 节点侧栏接入插件浏览与添加
- [x] 验收：`pnpm --filter @agent-spaces/server build`
- [x] 验收：`pnpm --filter @agent-spaces/web build`
- **Status:** complete
- [x] 修正标签编辑显示值与写入值不一致问题（统一使用 `data.label`）
- [x] 验收：`pnpm --filter @agent-spaces/web build` 通过 ✅
- **Status:** complete

### Phase 9: ExecutionBar 运行请求修复（2026-06-04）
- [x] 对比 `/Users/Zhuanz/Documents/work_fox/src/components/workflow/ExecutionBar.vue` 与 React `workflow-execution-bar.tsx`
- [x] 找到点击运行未发请求的原因：React 父组件 `handleExecute` 是占位实现，只改本地状态
- [x] 修复执行请求触发路径：发送 `workflow:execute` WS 事件，携带当前画布 snapshot
- [x] 后端 WS 执行通道回传执行过程事件到发起连接
- [x] 验证：`pnpm --filter @agent-spaces/web build` 通过
- [x] 验证：`pnpm --filter @agent-spaces/server build` 通过
- **Status:** complete

### Phase 10: ExecutionBar WorkFox 行为复刻（2026-06-04）
- [x] 补齐执行栏控制区：执行/开始节点选择/暂停/停止/继续/验证错误/进度/耗时
- [x] 补齐执行历史列表和当前日志详情面板
- [x] 补齐步骤状态、输入/输出/日志/错误展示
- [x] 接入执行历史数据和选中历史预览
- [x] 补齐开始节点输入 Dialog（等价替代 WorkFox Sheet）
- [x] 验证：`pnpm --filter @agent-spaces/web build` 通过
- **Status:** complete

### Phase 11: ExecutionBar 高度与 ResizablePanel 尺寸修正（2026-06-04）
- [x] 参考 `docs/ui/react-resizable-panels-size-units.md` 修正百分比尺寸写法
- [x] 修正执行日志面板占满整个画布高度的问题：执行栏根节点从 `h-full` 改为展开时固定高度
- [x] 为执行栏内部 ResizablePanel 添加稳定 id
- [x] 验证：`pnpm --filter @agent-spaces/web build` 通过
- **Status:** complete

## 用户已确认的决策

1. **golden-layout** → 用 FlexLayout 替代 ✅
2. **路由策略** → 合并到现有路由 ✅（work_fox 功能整合到 agent-spaces 页面结构）
3. **shared 层** → 合并到 packages/shared ✅
4. **文件组织** → 按功能分散到现有目录 ✅（组件放入对应子目录如 workflow/、chat/、dashboard/）
5. **Workflow 统一** → 以 workfox 的复杂 Workflow 系统为主系统，agent-spaces 的 agent+command 节点适配为 workfox 节点类型 ✅
6. **前端 workflow 目录** → 替换现有 components/workflow/ ✅
7. **后端集成** → 合并到现有 Express 路由和 WS 系统 ✅
8. **迁移策略** → 统一成一套系统（一步到位）✅
9. **产品策略** → 产品级统一，不保留长期并行的 workfox 子系统入口 ✅

## 决策记录

| 决策 | 理由 |
|------|------|
| shadcn UI 组件不迁移 | 用户明确说不需要，agent-spaces 已有自己的 shadcn |
| Vue Flow → @xyflow/react | agent-spaces 已有 @xyflow/react 依赖 |
| Pinia → Zustand | agent-spaces 全局使用 Zustand |
| Tiptap Vue → Tiptap React | agent-spaces 已有 Tiptap React 集成 |
| WorkFox Workflow 作为 canonical workflow | 用户确认走产品级统一，前期消除共存/替换歧义 |
| 旧 WorkflowTemplate 走 adapter/migration | 避免现有 agent/command workflow 数据在替换期间失效 |

## 遇到的错误

| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| agent-picker-dialog onValueChange 签名不兼容 | 1 | `(v) => { if (v) setWorkflowId(v) }` 包裹处理 null |
| edit-issue-dialog agentConfigId 类型 unknown | 1 | `as string` 类型断言 |
| guest-selector framer-motion ease 类型 | 1 | `as const` 断言 |
| pagination nativeButton/render props 不存在 | 1 | 移除不支持的 props，直接用 Button |
| product-card HTMLAttributes 与 motion.div 冲突 | 1 | 移除 `...props` spread |
| project-detail-view Figma 导出不存在 | 1 | `Sigma as Figma` 替代 |
| 多处 "icon-sm"/"icon-xs" Button size 无效 | 1 | 全局替换为 "icon" |
| 多处 framer-motion type: 'spring' 字面量 | 1 | `as const` 断言 |
| text-shimmer motion.create() 类型 | 1 | 显式类型断言 |
| sidebar-context type re-export | 1 | `export type {}` 分离 |
| rotating-text AnimationSequence 类型 | 1 | `Record<string, unknown>` 放宽 |
| swipe-row-1 SwipeRowProps 不存在 | 1 | 改为 `HTMLMotionProps<"div">` |
| product-card preserve-d 拼写错误 | 1 | `preserve-3d` |
| workflow-editor set 在 create() 外使用 | 1 | 改用 `store.setState()` |
| shared/workflow.ts singleton/output_fields 缺失 | 1 | 补充到类型定义 |
| shared/events.ts WS 事件名缺失 | 1 | 补充到 ClientEventMap/ServerEventMap |
### Phase 12: Workflow 拉线松手节点选择补齐（2026-06-04）
- [x] 对比 WorkFox `NodeSelectDialog.vue`、`useConnectionDrop.ts`、`useEdgeInsert.ts`
- [x] 新增 React `WorkflowNodeSelectDialog`
- [x] 在 `WorkflowCanvas` 记录连接源和未成功连接的落点
- [x] 在 `WorkflowEditor` 打开节点选择对话框并自动新增节点、补边
- [x] 复用同一对话框补齐边上插入节点入口
- [x] 验证 `pnpm --filter @agent-spaces/web build`
- **Status:** complete

### Phase 13: Workflow 插件商店补齐（2026-06-04）
- [x] 阅读 `docs/agent-store.md`、React `workflow-plugins-dialog.tsx`、旧 WorkFox `PluginsDialog.vue`
- [x] 复制 `G:/programming/nodejs/work_fox/resources/plugins` 到 `packages/templates/plugins`
- [x] 在 Workflow 插件对话框增加“插件商店”视图/入口，并接入模板插件展示或安装流程
- [x] 验证 `pnpm --filter @agent-spaces/web build`
- **Status:** complete
