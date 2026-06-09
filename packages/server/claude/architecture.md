# 架构详解

## Agent 运行时架构

支持 6 种运行时，通过 `createAgentRuntime(config)` 工厂函数按 `config.kind` 切换。

| 运行时 | kind | 文件 | 行数 |
|--------|------|------|------|
| OpenAgentSdk | open-agent-sdk | adapters/open-agent-sdk-runtime.ts | 332 |
| ClaudeCode | claude-code | adapters/claude-code-runtime/ (7 文件) | ~1300 |
| Codex | codex | adapters/codex-runtime.ts | 602 |
| LangChain | langchain | adapters/langchain-runtime.ts | 954 |
| Hermes | hermes | adapters/hermes-runtime.ts | 901 |
| OhMyPi | oh-my-pi | adapters/oh-my-pi-runtime.ts | 943 |

### ClaudeCodeRuntime 子模块

| 文件 | 说明 |
|------|------|
| index.ts | 主类（364 行） |
| sdk-config.ts | SDK 配置构建（239 行） |
| adapter-pool.ts | Bridge 引用计数式复用池 |
| anthropic-bridge.ts | HTTP Bridge 服务器（232 行） |
| protocol-converter.ts | 协议转换（339 行） |
| message-format.ts | 消息格式化（279 行） |
| types.ts | 类型定义 |

## Workflow 执行引擎

execution-manager.ts（1757 行）实现完整的 DAG 执行引擎：

- DAG 拓扑遍历 + 依赖调度
- 循环节点（LOOP 复合节点）
- 条件分支
- 变量系统
- 断点调试 + 恢复
- Plugin 节点集成
- 交互管理（alert/prompt/form/table_confirm）

## Issue 自动化流程

```
Issue 创建 -> workflowId?
  -> 有: loadWorkflow -> createTasksFromWorkflow -> 依赖调度 -> runIssueTask
  -> 无: Issue -> error
```

关键文件：
- issue-agent-runner.ts（66 行）：入口
- issue-task-controller.ts（851 行）：任务控制器
- issue-retry.ts（96 行）：启动时恢复

## 通知中心

services/notification-hub/（14 文件）：
- lark-adapter.ts / wechat-adapter.ts：飞书/企微适配器
- bot-agent.ts：Bot Agent 执行
- bot-commands.ts（405 行）：16 个内置斜杠命令
- service.ts：服务生命周期管理

## 代码结构

```
src/
  app.ts (435 行)          # 入口
  middleware/auth.ts        # 认证
  routes/ (37 文件)         # REST API
  services/ (50+ 文件)      # 业务逻辑
  storage/ (20+ 文件)       # 持久化
  adapters/ (16 文件)       # Agent 运行时
  agents/ (10 文件)         # Agent 编排
  ws/ (8 文件)              # WebSocket 处理
  hooks/ (1 文件)           # Agent Hook 链
```
