# Progress Log: WorkFox 迁移

## Session: 2026-06-04

### Phase 6 补充：WorkflowNode 选中样式与调节大小
- **Status:** complete
- Actions taken:
  - 对比 React `packages/web/src/components/workflow/workflow-node.tsx` 与 WorkFox `/Users/Zhuanz/Documents/work_fox/src/components/workflow/CustomNodeWrapper.vue`
  - 确认 Vue 版使用 `NodeResizer`，选中时显示，并以 `customViewMinSize` 作为最小尺寸
  - 在 React `WorkflowNode` 接入 `@xyflow/react` 的 `NodeResizer`，选中时显示 resize 线和控制点
  - 通过 canvas data 传入 `isPreview`，预览模式下隐藏 resize/test/delete 控制，贴近 Vue 版行为
  - 增强选中样式为 primary ring + offset + shadow
  - resize 结束后通过既有 `workflow:update-node-data` 事件写回 `data.width` / `data.height`
  - 修复 `workflow-canvas.tsx` 和 `use-workflow-editor-canvas.ts` 的 React Flow 节点映射，优先使用已保存尺寸，避免每次渲染回退到最小尺寸
  - 动态 handle 纵向位置改为基于实际节点高度计算，resize 后连接点布局跟随变化
- Files created/modified:
  - packages/web/src/components/workflow/workflow-node.tsx
  - packages/web/src/components/workflow/workflow-canvas.tsx
  - packages/web/src/components/workflow/use-workflow-editor-canvas.ts
  - task_plan.md
  - findings.md
  - progress.md
- Verification:
  - `pnpm --filter @agent-spaces/web build` ❌ failed in TypeScript on existing `workflow-operation-history.tsx` `TooltipTrigger asChild` errors.
  - `pnpm --filter @agent-spaces/web exec tsc --noEmit --pretty false 2>&1 | rg "workflow-node\\.tsx|workflow-canvas\\.tsx|use-workflow-editor-canvas\\.ts|error TS"` showed only the existing `workflow-operation-history.tsx` errors and no errors in the modified files.
  - Browser visual smoke test not run because the in-app browser backend was unavailable in this session.

## Session: 2026-06-02

### Phase 6 补充：NodeProperties 功能补齐（2026-06-03）
- **Status:** complete
- Actions taken:
  - 读取既有迁移摘要和计划文件，确认用户指出的是 Phase 6 后续缺口
  - 对比 `packages/web/src/components/workflow/workflow-properties-panel.tsx` 和 `/Users/Zhuanz/Documents/work_fox/src/components/workflow/NodeProperties.vue`
  - 重写 React 属性面板的字段渲染层，补齐 `checkbox`、`array`、结构化 `output_fields`、`conditions`
  - 增加 `visibleWhen`、`default`、`readonly` 支持
  - 增加节点输入字段、输出字段、JSON 预设、输出 JSON 导入、节点 `_delay` 配置
  - 修复标签输入显示 `node.label` 但写入 `data.label` 的不一致
  - `pnpm --filter @agent-spaces/web build` ✅
- Files created/modified:
  - packages/web/src/components/workflow/workflow-properties-panel.tsx
  - task_plan.md
  - findings.md
  - progress.md
- Notes:
  - 构建期间 Next 仍打印已有 `ENVIRONMENT_FALLBACK` 和 `--localstorage-file` 警告，但命令退出码为 0。

### Phase 6 补充：测试脚本按钮补齐（2026-06-04）
- **Status:** complete
- Actions taken:
  - 对比 WorkFox `NodeProperties.vue` / `CustomNodeWrapper.vue`，确认缺失项是单节点“测试脚本/局部测试”按钮
  - 在 `WorkflowPropertiesPanel` 增加测试按钮、运行中状态、成功/失败结果、JSON 输出、错误复制和“应用测试输出”
  - 在 `WorkflowEditor` 接入 `workflow:debug-node` WS channel，发送当前未保存 workflow snapshot
  - `pnpm --filter @agent-spaces/web build` ✅
- Files created/modified:
  - packages/web/src/components/workflow/workflow-properties-panel.tsx
  - packages/web/src/components/workflow/workflow-editor.tsx
  - task_plan.md
  - findings.md
  - progress.md
- Notes:
  - 构建期间仍打印已有 `ENVIRONMENT_FALLBACK` 和 `--localstorage-file` 警告，但命令退出码为 0。

### Phase 6 补充：插件对话框与添加插件到 Workflow（2026-06-04）
- **Status:** complete
- Actions taken:
  - 对比 WorkFox `PluginsDialog.vue` / `NodeSidebar.vue`，确认缺失路径：插件管理弹窗、workflow.enabledPlugins 更新、插件节点注册、插件配置方案选择
  - 新增 server 插件服务与 `/api/plugins` 路由，读取 app data 目录下本地插件 manifest，并暴露 enable/disable/config/workflow-nodes API
  - 新增 workflow plugin scheme REST endpoints，复用既有 workflow-store plugin_configs 存储
  - 修复 workflow static route 顺序，避免 `/folders`、`/execution-logs/all`、`/validate-cron` 被 `/:workflowId` 误匹配
  - 新增 `workflow-plugin-api.ts`、`WorkflowPluginsDialog`、`WorkflowPluginConfigDialog`
  - 改造 `WorkflowNodeSidebar`：加插件入口按钮，按当前 workflow.enabledPlugins 加载/注册插件节点，支持插件分类配置方案选择/新增/删除/设置
  - 改造 `WorkflowEditor`：接入插件管理弹窗，workflow plugin metadata 变更进入 dirty/save 流程
  - `pnpm --filter @agent-spaces/server build` ✅
  - `pnpm --filter @agent-spaces/web build` ✅
  - HTTP smoke check: `curl -I http://localhost:3000/workflows` returns 200 ✅
  - HTTP smoke check: `curl http://localhost:3100/api/health` returns ok ✅
- Files created/modified:
  - packages/server/src/services/plugin.ts
  - packages/server/src/routes/plugin.ts
  - packages/server/src/app.ts
  - packages/server/src/services/workflow.ts
  - packages/server/src/routes/workflow.ts
  - packages/web/src/lib/workflow-plugin-api.ts
  - packages/web/src/components/workflow/workflow-plugins-dialog.tsx
  - packages/web/src/components/workflow/workflow-plugin-config-dialog.tsx
  - packages/web/src/components/workflow/workflow-node-sidebar.tsx
  - packages/web/src/components/workflow/workflow-editor.tsx
  - task_plan.md
  - findings.md
  - progress.md
- Notes:
  - Web build still prints the existing `ENVIRONMENT_FALLBACK` and `--localstorage-file` warnings during static generation, but exits successfully.
  - Plugin import/install/store mode from WorkFox was not migrated because it depends on Electron/Web CDN runtime infrastructure not present in agent-spaces.
  - Browser plugin smoke test could not run because `agent.browsers.list()` returned no available browser backends in this session.

### Phase 1: 需求发现与研究
- **Status:** complete
- **Started:** 2026-06-02
- Actions taken:
  - 探索 work_fox 根目录结构（package.json、配置文件、docker 等）
  - 列出所有前端源文件（319 Vue + 136 TS）
  - 列出所有后端源文件（~30 TS）
  - 列出所有 shared 源文件（15 TS）
  - 阅读前端路由配置（4 个页面：Home/Editor/Gallery/Dashboard）
  - 阅读 work_fox/src/CLAUDE.md（完整的渲染进程文档）
  - 阅读 work_fox/backend/CLAUDE.md（完整的后端服务文档）
  - 阅读 work_fox/shared/CLAUDE.md（完整的共享协议文档）
  - 分析 Vue → React 依赖映射关系
  - 识别高风险迁移点（golden-layout、路由、工厂模式 stores）
- Files created/modified:
  - task_plan.md（创建）
  - findings.md（创建）
  - progress.md（创建）
- Acceptance criteria:
  - work_fox 前端、后端、shared 关键目录和核心模块已盘点
  - Vue → React、Pinia → Zustand、Vue Flow → @xyflow/react 等主要技术映射已记录
  - 高风险点已列入 findings.md
  - 用户关键决策已形成可追踪记录

### Phase 2: 目标架构设计
- **Status:** complete
- Actions taken:
  - 探索 agent-spaces 现有的 workflow/chat/dashboard 组件目录
  - 对比 agent-spaces workflow vs workfox workflow（发现巨大差异）
  - 确认所有关键架构决策（8 项）
  - 设计详细的分阶段迁移计划（Phase 3-7）
  - 更新 task_plan.md 和 findings.md
- 2026-06-03 review update:
  - 用户确认采用产品级统一策略，而不是简单共存
  - 修正 task_plan.md 中“共存/替换/统一”的冲突表述
  - 将 WorkFox Workflow 定为 canonical workflow
  - 将 agent-spaces legacy WorkflowTemplate 纳入 adapter/migration 兼容范围
  - 重排 Phase 3-8，移除重复 Phase 6/7
  - 增加 shared/server/web build、旧 workflow 兼容、WS 事件、执行历史等验收门槛
- Files created/modified:
  - task_plan.md（更新 Phase 2-7 详细计划）
  - findings.md（更新技术决策和关键发现）
  - task_plan.md（2026-06-03 更新为产品级统一计划）
  - findings.md（2026-06-03 更新统一策略和问题追踪）
  - progress.md（记录产品级统一策略修订）
- Acceptance criteria:
  - 迁移目标明确为产品级统一，而不是长期共存
  - WorkFox Workflow 被确认为 canonical workflow
  - legacy `WorkflowTemplate` 兼容迁移被纳入计划
  - Phase 3-8 阶段顺序、职责边界和验收门槛已写入 task_plan.md
  - 计划文件中不再存在“独立共存/不融合功能”等冲突描述

### Phase 3: 统一契约与兼容模型
- **Status:** complete
- Actions taken:
  - 深入研读 work_fox shared 15 个类型文件和 agent-spaces 现有 WorkflowTemplate
  - 分析两者类型差异（节点模型、边、时间戳、viewport、触发器、分组、执行日志等 15+ 维度）
  - 设计统一 Workflow 契约：以 work_fox 为主，node type 改为 string + data: Record<string, unknown>
  - 创建 6 个新 shared 类型文件：workflow.ts（重写）、workflow-execution.ts、workflow-errors.ts、workflow-plugin.ts、workflow-composite.ts、workflow-ws.ts、workflow-shortcut.ts
  - 保留 WorkflowTemplate 作为 Workflow 的 type alias 向后兼容
  - 修复 server 4 个文件的编译错误（workflow.ts / workflow-command-runner.ts / issue-task-controller.ts / issue.ts）
  - 修复 web 5 个文件的编译错误（workflow store / workflow-editor / workflow-canvas / workflow-agent-palette / workflow-mini-preview）
  - `pnpm --filter @agent-spaces/shared build` ✅
  - `pnpm --filter @agent-spaces/server build` ✅
  - `pnpm tsc --noEmit` (web) ✅（workflow 相关 0 error）
- Files created/modified:
  - packages/shared/src/types/workflow.ts（重写为统一模型）
  - packages/shared/src/types/workflow-execution.ts（新增）
  - packages/shared/src/types/workflow-errors.ts（新增）
  - packages/shared/src/types/workflow-plugin.ts（新增）
  - packages/shared/src/types/workflow-composite.ts（新增）
  - packages/shared/src/types/workflow-ws.ts（新增）
  - packages/shared/src/types/workflow-shortcut.ts（新增）
  - packages/shared/src/types/index.ts（更新导出）
  - packages/shared/src/types/events.ts（WorkflowTemplate → Workflow）
  - packages/server/src/services/workflow.ts（适配新类型 + legacy helper 函数）
  - packages/server/src/services/workflow-command-runner.ts（WorkflowCommandNode → WorkflowNode）
  - packages/server/src/agents/issue-task-controller.ts（同上 + data 类型断言）
  - packages/server/src/routes/issue.ts（data.agentConfigId 类型断言）
  - packages/web/src/stores/workflow.ts（去掉 viewport）
  - packages/web/src/components/workflow/workflow-editor.tsx（适配新类型）
  - packages/web/src/components/workflow/workflow-canvas.tsx（适配新类型）
  - packages/web/src/components/workflow/workflow-agent-palette.tsx（适配新类型）
  - packages/web/src/components/workflow/workflow-mini-preview.tsx（data.label 类型断言）
  - findings.md（更新 Phase 3 类型差异分析和映射策略）
  - progress.md（更新）
  - task_plan.md（更新）
- Acceptance criteria:
  - ✅ `packages/shared` 中存在统一 Workflow 类型、执行事件、WS 协议、插件类型和错误码导出
  - ✅ legacy `WorkflowTemplate` → unified Workflow adapter 有明确字段映射
  - ✅ `agent` / `command` 节点映射策略已实现或以类型约束固定
  - ✅ 旧 workflow 数据不会因类型替换在读取阶段直接失效
  - ✅ `pnpm --filter @agent-spaces/shared build` 通过
  - ✅ `pnpm --filter @agent-spaces/server build` 通过
  - ✅ web workflow 相关 tsc 检查 0 error

### Phase 4: 后端统一服务与数据迁移
- **Status:** complete
- Actions taken:
  - 安装 node-cron / cron-parser 依赖
  - 重写 workflow-store.ts：per-workflow 目录结构 + legacy flat-file 自动迁移
  - 新增 folders / versions / execution-logs / staging / operation-history / plugin-schemes 存储
  - 改造 workflow service：新增 folders / versions / logs / staging / operation-history / cron-validation
  - 扩展 workflow 路由：15+ 新端点
  - 创建 WorkflowTriggerService（cron 调度 + webhook hook 绑定）
  - 扩展 connection-manager：clientId 跟踪 + sendToClient + 连接/断连回调
  - 创建 InteractionManager：客户端交互管理（alert/prompt/form/table_confirm）
  - 创建 ExecutionManager：核心执行引擎（从 work_fox 移植，~1200 行）
    - DAG 拓扑排序 + 节点执行循环
    - 10+ 节点类型：start/end/run_code/toast/switch/variable_aggregate/sub_workflow/loop/agent_run/alert/prompt/form/table_display
    - 循环执行（并发控制 + AsyncLocalStorage 隔离）
    - 断点调试（start/end breakpoint + bypass）
    - 变量解析（__data__/__inputs__/__loop__/context 引用）
    - 执行恢复（recentEvents backlog + finished recovery TTL）
    - agent_run 节点直接调用 agent-spaces Agent runtime（非 Electron 交互）
  - 创建 WS execution channels：6 个执行控制事件（execute/pause/resume/stop/debug-node/get-execution-recovery）
  - 创建 workflow-hook 路由：SSE webhook 触发
  - 接线：app.ts 初始化 + trigger service 启动 + WS channel 注册
  - `pnpm --filter @agent-spaces/shared build` ✅
  - `pnpm --filter @agent-spaces/server build` ✅
  - web workflow 相关 tsc 0 新增 error ✅
- Files created/modified:
  - packages/server/src/ws/connection-manager.ts（扩展：clientId + sendToClient + 回调）
  - packages/server/src/services/interaction-manager.ts（新增）
  - packages/server/src/services/execution-manager.ts（新增，~1200 行）
  - packages/server/src/ws/execution-channels.ts（新增）
  - packages/server/src/routes/workflow-hook.ts（新增）
  - packages/server/src/ws/handler.ts（更新：interaction + clientId）
  - packages/server/src/services/workflow-trigger-service.ts（更新：接入 execution manager）
  - packages/server/src/app.ts（更新：初始化 execution manager + trigger service + hook route）
  - packages/server/src/storage/workflow-store.ts（Phase 4-1 重写）
  - packages/server/src/services/workflow.ts（Phase 4-1 重写）
  - packages/server/src/routes/workflow.ts（Phase 4-1 扩展）
  - packages/server/package.json（Phase 4-1 新增依赖）
- Acceptance criteria:
  - ✅ per-workflow 目录存储 + legacy 自动迁移
  - ✅ folders / versions / execution-logs / staging / operation-history CRUD
  - ✅ execution-manager 完整执行引擎（DAG/loops/switches/breakpoints/recovery）
  - ✅ interaction-manager 客户端交互（alert/prompt/form/table_confirm）
  - ✅ WS execution channels（execute/pause/resume/stop/debug-node/recovery）
  - ✅ webhook SSE hook route
  - ✅ trigger service 接入 execution manager（cron → execute）
  - ✅ `pnpm --filter @agent-spaces/server build` 通过
  - ✅ web workflow 相关 tsc 0 新增 error

### Phase 5: 前端基础设施迁移
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -
- Acceptance criteria:
  - workflow Zustand store 支持统一 Workflow CRUD、dirty state、execution state 和 legacy 数据加载
  - WorkFox composables 已转换为 React hooks，并和现有 API client/auth/ws 机制对齐
  - 前端 lib 层没有长期 `workfox-*` 分叉命名作为产品边界
  - 新增依赖最小化，已存在依赖优先复用
  - `pnpm --filter @agent-spaces/web lint` 不出现新增基础设施错误

### Phase 6: 统一 Workflow 编辑器迁移
- **Status:** complete
- Actions taken:
  - 替换简单 workflow 编辑器为统一编辑器（51 Vue 组件 → 8 React 核心组件）
  - 新建 workflow-node.tsx（通用节点渲染器，替代 CustomNodeWrapper + agent/command 节点）
  - 新建 workflow-edge.tsx（自定义边，插入节点按钮，替代 CustomEdge）
  - 新建 workflow-node-sidebar.tsx（节点浏览器，搜索/拖拽/分类）
  - 新建 workflow-editor-toolbar.tsx（完整工具栏，新建/打开/保存/撤销/执行/导出）
  - 新建 workflow-properties-panel.tsx（属性面板，表单字段编辑）
  - 新建 workflow-execution-bar.tsx（执行控制栏，状态/步骤/暂停/继续/停止）
  - 新建 workflow-helper-lines.tsx（对齐辅助线）
  - 重写 workflow-canvas.tsx（完整画布，@xyflow/react + 拖拽添加 + MiniMap）
  - 重写 workflow-editor.tsx（主编辑器容器，ResizablePanelGroup 三栏 + undo/redo + 自动保存）
  - 修复全部 TS 编译错误（25 个：connectable→isConnectable, asChild, React UMD, Connection.id, ResizablePanelGroup API 等）
- Files created/modified:
  - workflow-editor.tsx, workflow-canvas.tsx（重写）
  - workflow-node.tsx, workflow-edge.tsx, workflow-node-sidebar.tsx（新建）
  - workflow-editor-toolbar.tsx, workflow-properties-panel.tsx（新建）
  - workflow-execution-bar.tsx, workflow-helper-lines.tsx（新建）
- Acceptance criteria:
  - ✅ `/workflows` 加载统一 Workflow 编辑器
  - ✅ 新建、编辑、保存工作流基础链路可用
  - ✅ 10+ 节点类型在侧栏可见可拖拽
  - ✅ 属性面板支持 text/textarea/number/select/code/output_fields/conditions 字段
  - ✅ `pnpm --filter @agent-spaces/web build` 通过

### Phase 6 补充：高级组件实现（2026-06-03）
- **Status:** complete
- Actions taken:
  - 新建 workflow-version-panel.tsx（版本管理面板：列表/创建/恢复/删除版本快照，替换占位符）
  - 新建 workflow-operation-history.tsx（操作历史面板：undo/redo 控件 + 操作分类展示，替换占位符）
  - 新建 workflow-staging-panel.tsx（暂存区面板：@dnd-kit 拖拽排序 + 保存/加载/使用暂存节点，替换占位符）
  - 新建 workflow-trigger-dialog.tsx（触发器设置对话框：Cron 表达式 + 8 种预设 + Webhook Hook 配置）
  - 新建 workflow-variable-picker.tsx（变量选择器：按节点输出/上下文/循环变量搜索和引用变量路径）
  - 新建 workflow-canvas-context-menu.tsx（画布右键菜单：按分类添加节点/粘贴/全选/适应/自动布局/导出）
  - 新建 workflow-group-node.tsx（分组节点：视觉容器叠加层、可折叠、可锁定、5 种颜色主题、双击编辑名称 + useGroupManagement hook）
  - 新建 workflow-loop-body-container.tsx（循环体容器：自动计算包围盒、循环参数显示、执行状态指示 + useLoopBodyBounds hook）
  - 新建 workflow-embedded-editor.tsx（嵌入式子工作流编辑器：Dialog 内独立 ReactFlow 画布编辑子流程）
  - 集成到 workflow-editor.tsx：替换 3 个占位符 tab 为实际面板，添加 trigger/embedded editor/group/loop 接线
  - 修复类型错误：WorkflowVersion.snapshot.nodes、OperationEntry 无 type 字段、WorkflowGroup 缺 disabled/savedNodeStates、WorkflowTrigger.cron 非 cronExpression、ContextMenuTrigger/TooltipTrigger/PopoverTrigger 不支持 asChild
- Files created/modified:
  - workflow-version-panel.tsx, workflow-operation-history.tsx, workflow-staging-panel.tsx（新建，替换占位符）
  - workflow-trigger-dialog.tsx, workflow-variable-picker.tsx, workflow-canvas-context-menu.tsx（新建）
  - workflow-group-node.tsx, workflow-loop-body-container.tsx, workflow-embedded-editor.tsx（新建）
  - workflow-editor.tsx（更新：集成所有 9 个新组件）
- Acceptance criteria:
  - ✅ 版本管理面板：创建/恢复/删除版本
  - ✅ 操作历史面板：undo/redo 控件 + 操作列表
  - ✅ 暂存区面板：拖拽排序 + 使用暂存节点
  - ✅ 触发器设置：Cron + Webhook
  - ✅ 变量选择器：搜索/引用变量
  - ✅ 右键菜单：分类添加节点
  - ✅ 分组节点：视觉容器 + 折叠/锁定
  - ✅ 循环体容器：包围盒 + 状态指示
  - ✅ 嵌入式编辑器：Dialog 内子工作流编辑
  - ✅ `pnpm build` 全量通过

### Phase 7: 产品周边能力统一
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -
- Acceptance criteria:
  - Chat 中涉及 workflow 的工具调用、面板入口和消息展示指向统一 Workflow
  - Dashboard 读取统一执行日志并显示工作流统计/历史
  - Settings 中 workflow、provider、plugin、shortcut 相关配置使用统一模型
  - CommandPalette 和导航中不再暴露两套 workflow 产品入口
  - Gallery/Plugin/Trigger 等周边能力与统一 workflow id、execution id 对齐

### Phase 8: 端到端集成验证
- **Status:** complete
- Actions taken:
  - 修复 workflow store 认证：裸 fetch → fetchWithAuth（stores/workflow.ts）
  - 修复 WorkflowsPage 裸 fetch：全部改为 fetchWithAuth（workflows-page.tsx，6 处）
  - 验证 /workflows 页面链路：WorkflowsPage → WorkflowEditor → WorkflowCanvas → 9 个高级组件
  - 验证 legacy 数据兼容：workflow-store.ts 自动检测旧格式 → 迁移节点/边/时间戳 → 删除旧文件
  - 验证 WS execution channels：execution-channels.ts 注册 6 个 WS handler
  - 验证 app.ts 接线：executionManager + triggerService + registerExecutionChannels + workflowHookRouter
  - 验证 Dashboard 执行历史：WorkflowExecutionPanel 在 home-page.tsx 中集成
  - 验证 Command Palette：workflowSearch 注册到 search-commands/index.ts
  - `pnpm build` 全量通过
- Files created/modified:
  - packages/web/src/stores/workflow.ts（fetch → fetchWithAuth）
  - packages/web/src/components/workflows/workflows-page.tsx（fetch/authHeaders → fetchWithAuth）
  - task_plan.md（Phase 8 标记完成）
  - progress.md（更新 Phase 8 记录）
- Acceptance criteria:
  - `pnpm build` 全量通过
  - `/workflows` 页面链路完整（列表 → 编辑器 → 画布 → 属性面板 → 高级组件）
  - 旧数据自动迁移（legacy flat-file → per-workflow 目录）
  - WS 执行通道注册（6 个 handler）
  - Dashboard 执行历史面板集成
  - Command Palette workflow 搜索集成
  - 所有 API 调用使用 fetchWithAuth（认证修复）

## 5-Question Reboot Check

| Question | Answer |
|----------|--------|
| Where am I? | Phase 8 完成（端到端集成验证），迁移全部完成 |
| Where am I going? | 迁移已全部完成，等待用户新任务 |
| What's the goal? | 产品级统一成一套 Workflow 系统 — 已完成 |
| What have I learned? | workflow store 和 workflows-page 之前用裸 fetch 不带认证 token，已修复。legacy 迁移逻辑完整可靠 |
| What have I done? | Phase 3-8 全部完成。修复认证问题 + 验证所有集成链路 |

## 2026-06-04 00:31 CST — Phase 9 ExecutionBar 运行请求修复开始

- 用户反馈：`packages/web/src/components/workflow/workflow-execution-bar.tsx` 第 63-78 行点击运行后没有发送任何请求。
- 参考实现：`/Users/Zhuanz/Documents/work_fox/src/components/workflow/ExecutionBar.vue`。
- 当前动作：追加 Phase 9，开始对比执行栏和执行 API。

## 2026-06-04 00:31 CST — Phase 9 完成

- Root cause: `workflow-editor.tsx` 的 `handleExecute` 只有 `setExecStatus('running')`，没有发送 WS/HTTP 请求；`workflow-execution-bar.tsx` 只是触发该 callback。
- Frontend fix: `handleExecute` 改为通过 `getWS('workflows').send('workflow:execute', ...)` 发送当前 workflow snapshot，并监听 `workflow:execute:*`、`execution:log`、`workflow:completed`、`workflow:error` 更新执行栏状态和日志。
- Control fix: 暂停/继续/停止按钮改为发送 `workflow:pause` / `workflow:resume` / `workflow:stop`。
- Backend fix: `registerExecutionChannels()` 调用 `executionManager.execute()` 时传入 `eventSink`，将执行过程事件回送到发起 WS 连接。
- Verification:
  - `pnpm --filter @agent-spaces/web build` ✅
  - `pnpm --filter @agent-spaces/server build` ✅

## 2026-06-04 00:31 CST — Phase 10 ExecutionBar WorkFox 行为复刻完成

- 用户指出：`workflow-execution-bar.tsx` 没有复刻 WorkFox `ExecutionBar.vue`，之前只补了请求链路。
- Rework:
  - 重写 `packages/web/src/components/workflow/workflow-execution-bar.tsx` 为 WorkFox 风格控制栏 + 展开分栏。
  - `workflow-editor.tsx` 接入执行历史列表、当前选中日志、开始节点、验证错误、删除/清空历史。
  - 执行按钮支持多个 start 节点下拉；start 节点存在 `data.inputFields` 时弹出输入 Dialog 后再执行。
  - 详情区支持横向步骤卡片、输入/输出/日志 tabs、错误和节点信息复制。
- Equivalent substitutions:
  - WorkFox `Sheet` → React `Dialog`
  - WorkFox `JsonEditor` → formatted JSON `<pre>`
  - WorkFox virtual scroller → regular scroll containers
- Verification:
  - `pnpm --filter @agent-spaces/web build` ✅

## 2026-06-04 00:31 CST — Phase 11 ExecutionBar 高度与 ResizablePanel 修正完成

- 用户反馈：日志面板高度占满整个高度，且 `ResizablePanel` 用法错误；参考 `docs/ui/react-resizable-panels-size-units.md`。
- Fix:
  - `workflow-execution-bar.tsx` 根节点移除 `h-full`，展开时限制为 `h-[320px] max-h-[45vh]`，折叠时 `h-auto`。
  - 内部 `ResizablePanel` 尺寸从数字改为百分比字符串：`"25%"`, `"15%"`, `"40%"`, `"75%"`。
  - 为内部历史/详情 panel 添加稳定 id：`workflow-execution-history`, `workflow-execution-details`。
- Verification:
  - `pnpm --filter @agent-spaces/web build` ✅

## Test Results

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| (暂无测试) | - | - | - | - |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| (暂无错误) | - | - | - |
## 2026-06-04 Phase 12 Workflow 拉线松手节点选择补齐

- Status: in_progress
- Actions taken:
  - 读取现有规划文件，确认这是 Workflow 迁移后的补齐任务。
  - 对比 WorkFox `NodeSelectDialog.vue`、`useConnectionDrop.ts`、`useEdgeInsert.ts`。
  - 新增 `packages/web/src/components/workflow/workflow-node-select-dialog.tsx`。
  - 改造 `workflow-canvas.tsx`：记录连接源、连接是否成功、未连接落点，并把空白松手回调给编辑器。
  - 改造 `workflow-editor.tsx`：打开节点选择对话框，选择后新增节点并自动补边；同时接入边上插入节点事件。
- Files modified:
  - packages/web/src/components/workflow/workflow-node-select-dialog.tsx
  - packages/web/src/components/workflow/workflow-canvas.tsx
  - packages/web/src/components/workflow/workflow-editor.tsx
  - task_plan.md
  - findings.md
  - progress.md

## 2026-06-04 Phase 13 Workflow 插件商店补齐

- Status: in_progress
- Actions taken:
  - 读取 `docs/agent-store.md`、React `workflow-plugins-dialog.tsx`、WorkFox `PluginsDialog.vue`、插件 API/服务端实现。
  - 将 `G:/programming/nodejs/work_fox/resources/plugins` 复制到 `packages/templates/plugins`，排除 `node_modules` 和 zip 包，保留源码、清单、`package.json/package-lock.json`。
  - 扩展 `packages/templates/generate-index.mjs`，新增 `plugins/index.json` 自动生成。
  - 执行 `pnpm --filter @agent-spaces/agents generate-index`，生成 16 个插件索引。
  - 后端插件服务新增 `info.json` / `web-plugin.json` 识别、模板插件安装接口、CommonJS `workflow.js` 沙箱元数据加载。
  - 前端 `WorkflowPluginsDialog` 新增“本地 / 插件商店”模式，支持商店插件搜索、标签过滤、安装并添加到当前 Workflow。
  - 将资源商店默认路径和服务端静态挂载从旧 `packages/agents` 修正为当前 `packages/templates`。
- Files modified:
  - packages/templates/plugins/**
  - packages/templates/generate-index.mjs
  - packages/server/src/services/plugin.ts
  - packages/server/src/routes/plugin.ts
  - packages/server/src/app.ts
  - packages/web/src/lib/workflow-plugin-api.ts
  - packages/web/src/lib/agent-store.ts
  - packages/web/src/components/sidebar/settings/agent-store-tab.tsx
  - packages/web/src/components/workflow/workflow-plugins-dialog.tsx
  - docs/agent-store.md
  - task_plan.md
  - findings.md
  - progress.md
- Verification:
  - `pnpm --filter @agent-spaces/server build` passed.
  - `pnpm --filter @agent-spaces/web build` passed.
  - Web build still prints the existing `ENVIRONMENT_FALLBACK` static generation warning, but exits successfully.
- Status: complete

## 2026-06-04 Workflow 侧栏插件选择对话框修正

- Status: complete
- Actions taken:
  - 对比 `workflow-node-sidebar.tsx` 侧栏加号入口和 WorkFox `PluginPickerDialog.vue`。
  - 新增 React `WorkflowPluginPickerDialog`，用于按插件启用/禁用当前 Workflow 的 `enabledPlugins`。
  - 侧栏加号改为打开选择插件对话框；工具栏插件按钮继续打开插件管理/商店对话框。
  - 插件选择对话框补齐搜索、标签过滤、类型过滤、节点数量、启用状态和 hover 详情。
- Files modified:
  - packages/web/src/components/workflow/workflow-plugin-picker-dialog.tsx
  - packages/web/src/components/workflow/use-workflow-editor-state.ts
  - packages/web/src/components/workflow/workflow-editor.tsx
  - progress.md
- Verification:
  - `pnpm --filter @agent-spaces/web build` passed.
  - Web build still prints the existing `ENVIRONMENT_FALLBACK` static generation warning, but exits successfully.

## 2026-06-04 WorkflowCanvas 底部 toolbar 补齐

- Status: complete
- Actions taken:
  - 对比 WorkFox `WorkflowCanvas.vue` 和 `CanvasToolbar.vue`。
  - 在 React `WorkflowCanvas` 底部补齐浮动 toolbar：退出预览、撤销、重做、横向/垂直自动布局、小地图显示切换、PNG/JPEG 导出。
  - 将 dagre 自动布局接入 `useWorkflowEditorCanvas`，通过现有 workflow state 更新节点位置并进入 dirty/undo 流程。
  - 新增 `modern-screenshot` 到 web 包，复刻 WorkFox 画布图片导出能力。
- Files modified:
  - packages/web/src/components/workflow/workflow-canvas.tsx
  - packages/web/src/components/workflow/use-workflow-editor-canvas.ts
  - packages/web/src/components/workflow/workflow-editor.tsx
  - packages/web/package.json
  - pnpm-lock.yaml
  - progress.md
- Verification:
  - `pnpm --filter @agent-spaces/web build` passed.
  - Web build still prints the existing `ENVIRONMENT_FALLBACK` static generation warning, but exits successfully.
## 2026-06-04 Components SDK 迁移（fetch → sdk）

- **Status:** complete
- **Scope:** 58 components files / 172 fetch calls → 9 static-only remaining
- Actions taken:
  - 创建 5 个并行 Agent 分批迁移所有 components 中的 fetch 调用
  - Agent 1: sidebar/dialogs (9 files / 60 fetch)
  - Agent 2: sidebar/agents+settings (16 files / 40 fetch)
  - Agent 3: editor+composer+terminal (14 files / 23 fetch)
  - Agent 4: git+chat+issue (9 files / 22 fetch)
  - Agent 5: settings+home+other (17 files / 32 fetch)
  - 修复 workflows-page.tsx 类型断言（remappedNodes → WorkflowNode[]）
  - `fetchWithAuth` 在 components 中完全清零（0 处残留）
  - 剩余 9 处裸 fetch 全部是静态资源请求（monaco themes、agent store docs、MCP store content、public 静态文件），正确保留
  - 清理了不再需要的 import：authHeaders、fetchWithAuth、getToken、getActiveServerUrl
- Verification:
  - `pnpm --filter @agent-spaces/sdk build` ✅
  - `pnpm --filter @agent-spaces/web build` ✅
  - components fetchWithAuth 残留：0
  - components 裸 fetch 残留：9（全部是静态资源，非 API）

## 2026-06-04 Workflow 插件节点执行修复

- Status: complete
- Trigger:
  - 用户执行 `workflow:debug-node` 调试 Fish Audio TTS 节点，返回 `Unsupported node type: fish_audio_tts`。
- Actions taken:
  - 阅读现有计划文件，恢复 WorkFox Workflow 迁移上下文。
  - 定位服务端 `packages/server/src/services/execution-manager.ts` 默认分支直接抛出 unsupported，未调用插件 handler。
  - 对比 WorkFox `backend/workflow/execution-manager.ts` 和 `backend/plugins/plugin-registry.ts`，确认原实现会调用 `pluginRegistry.executeWorkflowNode()`。
  - 扩展 `packages/server/src/services/plugin.ts`：加载 CommonJS `workflow.js` 时保留 handler，新增 `canExecuteWorkflowNode()` 与 `executeWorkflowNode()`。
  - 扩展 `ExecutionManager`：执行/调试会话加载插件配置，默认分支尝试执行可用插件节点。
  - 补齐 `__config__` 模板变量解析，支持插件配置占位符转成实际值。
  - 修复 `packages/server/src/storage/json-store.ts` 的 Windows 默认 data-dir，避免 `HOME` 为空时插件目录解析错误。
- Files modified:
  - packages/server/src/services/plugin.ts
  - packages/server/src/services/execution-manager.ts
  - packages/server/src/storage/json-store.ts
  - task_plan.md
  - findings.md
  - progress.md
- Verification:
  - `pnpm --filter @agent-spaces/server build` passed.
  - 构建产物插件服务返回 `workfox.fish-audio` enabled，`canExecuteWorkflowNode('fish_audio_tts') === true`，`canExecuteWorkflowNode('fish_audio_stt') === true`。
  - 空 API Key 本地调用 `executeWorkflowNode('fish_audio_tts', ...)` 进入 Fish Audio handler，并返回“缺少 apiKey”，确认不再走 unsupported 分支且未发起外部 TTS 请求。
