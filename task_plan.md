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

Phase 4 — 后端统一服务与数据迁移 ✅（完成）

下一个：Phase 5 — 前端基础设施迁移

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
- [ ] 复制 workfox/src/types → packages/web/src/types/workfox/
- [ ] 转换 Pinia stores → Zustand stores
  - stores/workflow/ (12 文件) → stores/workflow/
  - stores/chat.ts → stores/chat.ts 或现有 chat store 扩展
  - stores/ai-provider.ts / stores/agent-settings.ts / stores/chat-ui.ts
  - stores/dashboard.ts / stores/plugin.ts / stores/tab.ts
  - stores/shortcut.ts / stores/theme.ts / stores/userProfile.ts
- [ ] 转换 composables → React hooks
  - workflow/ 下 8 个 composable → hooks/workflow/
  - useCommandPalette / useNotification / useShortcutActions
- [ ] 转换 lib 层工具函数
  - lib/agent/ (7 文件) → lib/agent/ 或现有 agent lib 扩展
  - lib/backend-api/ (12 文件) → lib/backend-api/ 或 API client 扩展
  - lib/workflow/ (6 文件) → lib/workflow/
  - lib/ws-bridge.ts / lib/chat-db.ts / lib/dialog.ts
  - lib/plugins/web-client-runtime.ts
- [ ] 安装前端新增依赖（dexie / katex / lightgallery 替代库等）
- [ ] 验收：`pnpm --filter @agent-spaces/web lint` 不出现新增基础设施错误
- **Status:** pending

### Phase 6: 统一 Workflow 编辑器迁移
- [ ] 替换现有 packages/web/src/components/workflow/ 为统一编辑器实现
- [ ] 转换核心编辑器组件
  - WorkflowEditor.vue → workflow-editor.tsx（替换现有）
  - WorkflowCanvas.vue → workflow-canvas.tsx（替换现有）
  - CustomNodeWrapper.vue → custom-node-wrapper.tsx
  - CustomEdge.vue → custom-edge.tsx
- [ ] 转换节点相关组件
  - NodeProperties.vue / NodePropertyForm.vue / NodeSidebar.vue
  - NodeSelectDialog.vue / PluginPickerDialog.vue
  - EmbeddedWorkflowEditor.vue / EmbeddedWorkflowNode.vue / EmbeddedWorkflowEdge.vue
  - LoopBodyContainer.vue
  - GroupNode.vue / GroupManagePanel.vue / StickyNoteView.vue
- [ ] 转换编辑器面板组件
  - RightPanel / RightProperties / RightVersion / RightOperations / RightAssistant / RightStaging
  - EditorToolbar / CanvasToolbar / EditorRightBar / ActivityBar
  - ExecutionBar / ExecutionInputDrawer
  - HelperLines / VersionControl / OperationHistory / StagingPanel
  - WelcomePage / WorkflowList / WorkflowListDialog / WorkflowDialog / WorkflowMetadataDialog
  - WorkflowFolderTree / SubWorkflowSelector
  - VariablePicker / VariableFieldMenu / ConditionEditor / OutputFieldEditor
  - TableViewComponent / CanvasContextMenu
  - TriggerSettingsDialog
- [ ] 转换工作流布局上下文/工具
  - dragDrop.ts / helper-line-utils.ts / nodeSidebarContext.ts
  - workflowCanvasContext.ts / workflowLayoutContext.ts
- [ ] 更新现有 workflow store 以适配统一 Workflow 模型
- [ ] 保证旧 agent/command workflow 可在新编辑器中打开或显示迁移提示
- [ ] 验收：`/workflows` 页面可加载；新建、保存、重新打开工作流可用
- **Status:** pending

### Phase 7: 产品周边能力统一
- [ ] Chat 组件（ChatPanel/ChatInput/ChatMessage/ToolCallCard 等 ~13 个）→ 融入现有 components/chat/
- [ ] Dashboard 组件（StatsCards/ExecutionChart/ExecutionHistoryTable 等 ~9 个）→ 融入现有 dashboard/workflows 入口
- [ ] Settings 组件（SettingsDialog/SettingsModels 等 ~6 个）→ 适配到现有设置系统
- [ ] Gallery 组件（GalleryViewer/MusicPlayer）→ components/gallery/
- [ ] CommandPalette → 适配到现有 command-palette
- [ ] PluginSettings → 适配到现有插件系统
- [ ] 页面视图 → 适配到 Next.js App Router
- [ ] Utils 组件（FloatingPanel/WsMessageMonitor）
- [ ] App.vue 入口逻辑 → 适配到 Next.js layout
- [ ] 验收：Chat、Dashboard、Settings 中涉及 workflow 的入口指向统一 Workflow 系统
- **Status:** pending

### Phase 8: 端到端集成验证
- [ ] `pnpm --filter @agent-spaces/shared build`
- [ ] `pnpm --filter @agent-spaces/server build`
- [ ] `pnpm --filter @agent-spaces/web build`
- [ ] `pnpm build`
- [ ] 后端启动正常
- [ ] `/workflows` 统一入口可加载
- [ ] 旧 agent/command workflow 可读取、迁移或明确提示不可自动迁移
- [ ] 新工作流可新建、保存、重新打开
- [ ] WS 连接可建立并接收执行事件
- [ ] 执行历史和 Dashboard 可读取统一执行日志
- [ ] Chat 工具调用可引用统一 Workflow
- **Status:** pending

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
| (暂无) | - | - |
