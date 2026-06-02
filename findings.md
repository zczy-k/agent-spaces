# Findings & Decisions: WorkFox 迁移

## 需求摘要

- 将 work_fox 的工作流系统完整迁移到 agent-spaces
- 前端：Vue → React 转换
- 后端：合并到 Express 服务
- 产品级统一：WorkFox Workflow 作为 canonical workflow，agent-spaces 现有 agent/command workflow 通过 adapter/migration 纳入统一模型
- 不保留长期并行的两套 Workflow 产品入口
- shadcn 通用 UI 组件不需要迁移
- Electron 部分忽略

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

## 问题追踪

| 问题 | 状态 | 解决方案 |
|------|------|---------|
| golden-layout React 替代方案 | 已定 | 使用 flexlayout-react |
| 路由挂载策略 | 已定 | `/workflows` 作为统一 Workflow 产品入口 |
| shared 层合并方式 | 已定 | WorkFox 模型为主，legacy WorkflowTemplate 通过 adapter/migration 兼容 |
| 数据存储策略 | 已定 | 统一 Workflow 存储；保留旧数据读取和迁移路径 |
| 旧 workflow 数据迁移细节 | 待设计 | Phase 3 定义字段映射、失败处理和回滚策略 |
| agent/command 节点映射 | 待设计 | Phase 3 决定映射到 `agent_run` / `run_code` 或专用兼容节点 |
