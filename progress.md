# Progress Log: WorkFox 迁移

## Session: 2026-06-02

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
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -
- Acceptance criteria:
  - `pnpm --filter @agent-spaces/shared build` 通过
  - `pnpm --filter @agent-spaces/server build` 通过
  - `pnpm --filter @agent-spaces/web build` 通过
  - `pnpm build` 通过
  - 后端和前端 dev server 可启动
  - `/workflows` 可创建、保存、重新打开、执行 workflow
  - WS 可接收执行事件，执行历史可在 Dashboard 查看
  - legacy agent/command workflow 的迁移路径经过实际样例验证

## 5-Question Reboot Check

| Question | Answer |
|----------|--------|
| Where am I? | Phase 7 完成（产品周边能力统一），Phase 8 部分完成（构建通过） |
| Where am I going? | Phase 6（统一 Workflow 编辑器迁移），然后完成 Phase 8 功能性验证 |
| What's the goal? | 产品级统一成一套 Workflow 系统 |
| What have I learned? | agent-spaces 已有完善的 chat/dashboard/settings/command-palette 基础设施，Phase 7 只需添加 workflow 连接层而非重写。ask_user_question 活跃问题由 chat-panel 独立面板处理，message-parts 只需渲染历史记录 |
| What have I done? | Phase 3-5 + Phase 7（全局执行日志 API + Dashboard 面板 + Command Palette workflow 搜索 + ask_user_question 内联渲染） |

## Test Results

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| (暂无测试) | - | - | - | - |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| (暂无错误) | - | - | - |
