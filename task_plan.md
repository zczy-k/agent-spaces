# Task Plan: WorkFox 迁移到 Agent Spaces

## 目标

将 work_fox 项目的工作流系统（前端 Vue → React + 后端）完整迁移到 agent-spaces 项目中，合并后能正常启动和加载。不融合功能，仅确保两套系统共存在同一项目中可运行。

## 当前阶段

Phase 2 — 目标架构设计

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
| Vue 3 + Composition API | React 18 + Hooks | 中 |
| Pinia stores | Zustand stores | 低 |
| Vue Router | Next.js App Router | 高（路由模式完全不同） |
| Vue Flow (@vue-flow/core) | @xyflow/react | 中（agent-spaces 已有） |
| Tiptap vue-3 | Tiptap react（agent-spaces 已有） | 低 |
| radix-vue / reka-ui | radix-ui / shadcn/ui（agent-spaces 已有） | 低 |
| Dexie (IndexedDB) | Dexie（通用，不变） | 低 |
| vue-sonner | sonner（agent-spaces 已有） | 低 |
| golden-layout | 需评估（react-dock / 自定义） | 高 |
| vue-stream-markdown | react-markdown + 自定义流式 | 中 |
| vuedraggable | @dnd-kit（agent-spaces 已有） | 低 |
| @unovis/vue | recharts（agent-spaces 已有）或 @unovis/react | 低 |
| vue3-emoji-picker | 需评估替代方案 | 中 |
| vue-virtual-scroller | @tanstack/react-virtual | 低 |
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

### Phase 3: Shared 层迁移与统一
- [ ] 将 workfox/shared 类型定义合并到 packages/shared/src/types/
  - workflow-types.ts → workfox-workflow.ts（核心 Workflow/Node/Edge/ExecutionLog 类型）
  - channel-contracts.ts → workfox-channel-contracts.ts（WS 通道契约）
  - channel-metadata.ts → workfox-channel-metadata.ts（通道元数据）
  - ws-protocol.ts → workfox-ws-protocol.ts（WS 消息协议）
  - execution-events.ts → workfox-execution-events.ts（执行事件）
  - plugin-types.ts → workfox-plugin-types.ts（插件类型）
  - errors.ts → workfox-errors.ts（错误码）
  - workflow-composite.ts → workfox-workflow-composite.ts（复合节点）
  - embedded-workflow.ts → workfox-embedded-workflow.ts（嵌入式工作流）
  - workflow-local-bridge.ts → workfox-workflow-local-bridge.ts（本地桥接）
  - plugin-entry.ts + plugin-capability-loader.ts（插件加载）
  - shortcut-types.ts → workfox-shortcut-types.ts（快捷键类型）
- [ ] 将 agent-spaces 的 WorkflowTemplate 适配到 workfox Workflow 类型
- [ ] 更新 packages/shared/src/types/index.ts 导出
- [ ] 重新构建 packages/shared
- **Status:** pending

### Phase 4: 前端基础设施迁移
- [ ] 复制 workfox/src/types → packages/web/src/types/workfox/
- [ ] 转换 Pinia stores → Zustand stores
  - stores/workflow/ (12 文件) → stores/workfox-workflow/
  - stores/chat.ts → stores/workfox-chat.ts
  - stores/ai-provider.ts / stores/agent-settings.ts / stores/chat-ui.ts
  - stores/dashboard.ts / stores/plugin.ts / stores/tab.ts
  - stores/shortcut.ts / stores/theme.ts / stores/userProfile.ts
- [ ] 转换 composables → React hooks
  - workflow/ 下 8 个 composable → hooks/workfox-workflow/
  - useCommandPalette / useNotification / useShortcutActions
- [ ] 转换 lib 层工具函数
  - lib/agent/ (7 文件) → lib/workfox-agent/
  - lib/backend-api/ (12 文件) → lib/workfox-backend-api/
  - lib/workflow/ (6 文件) → lib/workfox-workflow/
  - lib/ws-bridge.ts / lib/chat-db.ts / lib/dialog.ts
  - lib/plugins/web-client-runtime.ts
- [ ] 安装新增依赖（dexie/node-cron/cron-parser/eventemitter2/katex 等）
- **Status:** pending

### Phase 5: 前端 Workflow 组件迁移（替换现有）
- [ ] 备份现有 packages/web/src/components/workflow/ (9 文件)
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
- [ ] 更新现有 workflow store 以适配新组件
- **Status:** pending

### Phase 6: 前端其他组件迁移
- [ ] Chat 组件（ChatPanel/ChatInput/ChatMessage/ToolCallCard 等 ~13 个）→ components/chat/workfox-*
- [ ] Dashboard 组件（StatsCards/ExecutionChart/ExecutionHistoryTable 等 ~9 个）→ components/dashboard/workfox-*
- [ ] Settings 组件（SettingsDialog/SettingsModels 等 ~6 个）→ 适配到现有设置系统
- [ ] Gallery 组件（GalleryViewer/MusicPlayer）→ components/gallery/
- [ ] CommandPalette → 适配到现有 command-palette
- [ ] PluginSettings → 适配到现有插件系统
- [ ] 页面视图 → 适配到 Next.js App Router
- [ ] Utils 组件（FloatingPanel/WsMessageMonitor）
- [ ] App.vue 入口逻辑 → 适配到 Next.js layout
- **Status:** pending

### Phase 7: 后端迁移
- [ ] 复制 backend 核心模块到 packages/server
  - workflow/ (4 文件: execution-manager/interaction-manager/trigger-service/hook-handler) → services/workfox-workflow/
  - chat/ (5 文件: chat-runtime/chat-event-sender/chat-tool-adapter/chat-workflow-tool-executor/client-node-cache) → services/workfox-chat/
  - storage/ (11 文件: workflow-store/workflow-version-store/execution-log-store 等) → storage/workfox/
  - plugins/ (3 文件: plugin-registry/builtin-fetch-api/builtin-fs-api) → services/workfox-plugins/
  - dashboard/ (1 文件: stats-store) → services/workfox-dashboard/
  - ws/ (12 文件: router/connection-manager/channels 等) → routes/workfox-ws/
  - app/ (3 文件: config/logger/create-server) → 合并到现有
- [ ] 集成 workfox WS channels 到现有 WebSocket 系统
- [ ] 集成 workfox HTTP 路由到现有 Express
- [ ] 安装后端新增依赖（node-cron/cron-parser/adm-zip/eventemitter2）
- **Status:** pending

### Phase 6: 后端迁移
- [ ] 复制 backend 核心模块到 packages/server
- [ ] 集成 WS channels（work_fox 的 WSRouter → Express 路由）
- [ ] 集成 storage 层（work_fox 的 JSON stores）
- [ ] 集成 workflow 引擎（ExecutionManager / InteractionManager / TriggerService）
- [ ] 集成 chat 运行时（ChatRuntime / ChatToolAdapter）
- [ ] 集成 Dashboard 统计
- [ ] 集成插件系统
- **Status:** pending

### Phase 7: 集成验证
- [ ] 确保前端构建通过（pnpm build）
- [ ] 确保后端启动正常
- [ ] 验证工作流编辑器页面可加载
- [ ] 验证 Chat 面板可加载
- [ ] 验证 Dashboard 页面可加载
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

## 决策记录

| 决策 | 理由 |
|------|------|
| shadcn UI 组件不迁移 | 用户明确说不需要，agent-spaces 已有自己的 shadcn |
| Vue Flow → @xyflow/react | agent-spaces 已有 @xyflow/react 依赖 |
| Pinia → Zustand | agent-spaces 全局使用 Zustand |
| Tiptap Vue → Tiptap React | agent-spaces 已有 Tiptap React 集成 |

## 遇到的错误

| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| (暂无) | - | - |
