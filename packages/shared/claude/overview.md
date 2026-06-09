# 架构总览

## 定位

`@agent-spaces/shared` 是 Agent Spaces monorepo 的**前后端共享类型定义包**。它是整个系统的"契约层"，定义了所有核心数据模型、WebSocket 事件协议、结构化消息 Parts、内置工具声明、Workflow DAG 模型、插件系统、订阅管理等接口类型。server 和 web 包通过 `import type { ... } from '@agent-spaces/shared'` 引用。

## 技术栈

- **语言**：TypeScript（strict 模式，ESNext 模块）
- **构建**：`tsc` 编译到 `dist/`，产出 ESM + `.d.ts` 类型声明
- **运行时依赖**：无（零运行时依赖）
- **开发依赖**：仅 `typescript ^5.8.3`

## 目录结构

```
src/
  index.ts              # 汇总导出（单一入口）
  types/
    index.ts            # 类型汇总导出（27 个子模块）
    workspace.ts        # 工作空间 + Agent 配置 + 通知设置
    issue.ts            # 议题模型
    task.ts             # 任务模型
    agent.ts            # Agent 会话 + 用量统计
    channel.ts          # 频道 + 消息 + 结构化 Parts
    file.ts             # 文件树节点
    git.ts              # Git 操作结果
    events.ts           # WebSocket 事件契约
    llm.ts              # LLM 模型与供应商
    tool.ts             # 内置 Agent 工具声明
    workflow.ts         # Workflow DAG 核心模型（Unified Workflow Types）
    workflow-execution.ts # Workflow 执行事件
    workflow-errors.ts  # Workflow 错误码体系
    workflow-plugin.ts  # Workflow 插件系统
    workflow-composite.ts # Workflow 复合节点工具函数
    workflow-shortcut.ts  # Workflow 快捷键类型
    workflow-ws.ts      # Workflow WebSocket 协议
    command.ts          # 快捷命令
    subscription.ts     # 订阅管理
    search.ts           # 代码搜索
    notification.ts     # 应用内通知
    speech.ts           # 语音识别
    code-favorites.ts   # 代码收藏
    hooks.ts            # Hook 配置
    database.ts         # 文档数据库
    kanban.ts           # Kanban 看板
    worktree.ts         # Git Worktree 并行开发
```

## 设计原则

1. **纯类型包**：仅导出 TypeScript 类型、接口、常量和纯函数，不包含运行时逻辑（Workflow 复合节点工具和插件解析函数除外）
2. **零依赖**：无任何运行时依赖，确保可在前后端任意环境安全引用
3. **统一契约**：server 和 web 必须遵守同一套类型定义，避免前后端数据不一致
4. **向后兼容**：通过 `@deprecated` 标注和类型别名（如 `WorkflowTemplate = Workflow`）保持迁移平滑
5. **聚合导出**：`src/index.ts` 通过 `export *` 聚合所有子模块，消费方只需引用 `@agent-spaces/shared`
