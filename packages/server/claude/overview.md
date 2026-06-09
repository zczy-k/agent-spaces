# @agent-spaces/server -- 总览

Express 5 后端服务，173 个 TypeScript 源文件。提供 REST API、WebSocket 实时通信、认证中间件、六运行时 Agent 编排引擎、Workflow DAG 执行引擎、Plugin 插件系统、通知中心、PTY 终端、Git 操作、SQLite Usage 统计等核心能力。

## 核心架构

- **Agent 运行时**：6 种（OpenAgentSdk/ClaudeCode/Codex/LangChain/Hermes/OhMyPi），通过 `createAgentRuntime()` 工厂切换
- **Workflow 执行引擎**：execution-manager.ts（1757 行），支持 DAG 遍历/循环/分支/变量/断点/恢复
- **持久化**：JSON 文件 + SQLite（node:sqlite），存储在 `~/.agent-spaces-data/`
- **WebSocket**：ws 库，3 个端点（主连接/语音/LSP）
- **认证**：Bearer Token + Secret Key

## 大文件

| 文件 | 行数 | 说明 |
|------|------|------|
| execution-manager.ts | 1757 | WorkFox DAG 执行引擎 |
| agent.ts | 1091 | Agent 会话服务 |
| agent-runner.ts | 1009 | @mention Agent 运行器 |
| oh-my-pi-runtime.ts | 943 | OhMyPi 运行时 |
| langchain-runtime.ts | 954 | LangChain 运行时 |
| hermes-runtime.ts | 901 | Hermes 运行时 |
| plugin.ts | 918 | Plugin 插件管理 |
| issue-task-controller.ts | 851 | Issue 任务控制器 |
| workflow-editor-tools.ts | 815 | Workflow 编辑工具 |
| message-parts.ts | 832 | 消息 Parts 构建 |
