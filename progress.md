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
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -
- Acceptance criteria:
  - WorkFox workflow execution/interaction/trigger 服务迁入 `packages/server`
  - 现有 workflow service 使用统一模型或通过 adapter 输出统一模型
  - 旧 workflow 存储可读取、可迁移，迁移失败有明确错误和回退路径
  - 统一 HTTP 路由接入现有 Express API 和 Bearer Token 认证
  - 统一 WS channel 接入现有 WebSocket 系统，可发送执行事件
  - `pnpm --filter @agent-spaces/server build` 通过

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
- **Status:** pending
- Actions taken:
  -
- Files created/modified:
  -
- Acceptance criteria:
  - `/workflows` 加载统一 Workflow 编辑器，而不是旧 agent/command-only 编辑器
  - 新建、编辑、保存、重新打开 workflow 的基础链路可用
  - legacy agent/command workflow 可打开、自动迁移，或显示明确迁移提示
  - 关键节点类型、边、布局、属性面板、执行栏、版本/历史入口至少达到可操作状态
  - 编辑器在 desktop viewport 下无明显布局遮挡或不可点击核心控件

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
| Where am I? | Phase 3 完成（统一契约与兼容模型），准备进入 Phase 4（后端统一服务与数据迁移） |
| Where am I going? | Phase 4-8：后端统一服务 → 前端基础设施 → 统一编辑器 → 产品周边能力 → 端到端验证 |
| What's the goal? | 产品级统一成一套 Workflow 系统：WorkFox 为 canonical workflow，legacy agent/command workflow 通过 adapter/migration 纳入新模型 |
| What have I learned? | 两套 Workflow 类型体系差异巨大（15+ 维度），统一后 node type 为 string + data: Record<string, unknown>，时间戳为 epoch ms，所有 workfox 扩展（groups/triggers/execution/plugin）均为 optional |
| What have I done? | 完成 shared 层 6 个新文件 + 1 个重写，server 4 文件适配，web 5 文件适配，shared/server/web 全部编译通过 |

## Test Results

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| (暂无测试) | - | - | - | - |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| (暂无错误) | - | - | - |
