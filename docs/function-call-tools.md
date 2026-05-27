# Function Call 工具

本文档描述 Agent 使用的服务端 function-call 工具层。

## 目标

Function-call 工具必须是真正可执行的服务端能力，而非仅停留在 prompt 描述层面。

该层提供：

- 运行时无关的工具抽象
- 服务端控制的执行，用于工作空间数据操作
- 内置 Issue 工具的严格频道级校验
- 运行时适配器，通过各自的原生工具协议暴露相同的工具

## 核心抽象

共享的服务端抽象为 `AgentFunctionTool`，定义在：

```text
packages/server/src/adapters/agent-runtime-types.ts
```

结构：

```ts
interface AgentFunctionTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    openWorld?: boolean;
  };
  execute: (input: unknown) => Promise<unknown>;
}
```

运行时处理器通过 `AgentRunOptions.functionTools` 接收这些工具。

## 内置 Issue 工具

当前内置工具位于：

```text
packages/server/src/services/builtin-tools/
```

Issue 工具列表：

- `CreateCurrentChannelIssue`
- `ViewCurrentChannelIssue`
- `AddCurrentChannelComment`

这些工具仅在当前频道上下文中可用，其中查看和评论要求当前频道绑定了 `issueId`。

重要约束：

- 工具输入必须包含 `issueId`
- `issueId` 必须与当前频道绑定的 `issueId` 匹配
- 工具无法创建或查看其他频道的 Issue
- 创建或更新当前 Issue 不会创建新频道。Issue 创建时已在 `issueService.create()` 中创建并绑定了频道

## 运行时集成

### Claude Code 运行时

实现在：

```text
packages/server/src/adapters/claude-code-runtime.ts
```

Claude 集成使用 Claude Agent SDK 的进程内 SDK MCP Server：

- `createSdkMcpServer()`
- `tool()`

服务端注册名为 `agent-spaces` 的 MCP Server。

每个 `AgentFunctionTool` 被转换为 SDK MCP 工具。当模型调用工具时，服务端执行 `AgentFunctionTool.execute()` 并将 JSON 结果作为 MCP 工具输出返回。

### 其他运行时

#### Codex runtime

Codex CLI 通过 MCP 配置发现外部工具。Codex runtime 会在当前运行有 `functionTools` 时启动一个短生命周期的本地 Streamable HTTP MCP server，并以 `agent-spaces` 名称注册到 Codex 的 `mcp_servers` config override。

这个本地 MCP server：

- 只监听 `127.0.0.1` 的随机端口。
- 在 `tools/list` 中暴露当前运行传入的 `AgentFunctionTool`。
- 在 `tools/call` 中执行当前 server 进程里的 `AgentFunctionTool.execute(input)`。
- 在 Codex run 结束、失败或中断后关闭。

#### OpenAgent SDK runtime

`open-agent-sdk` 当前未暴露相同的本地 function-tool 注册路径。

该 runtime 不应通过仅 prompt 的方式假装支持这些工具。后续适配器工作应将其原生自定义工具 API（如果有）映射到相同的 `AgentFunctionTool` 抽象。

## 执行流程

1. `runMentionedAgent()` 加载当前活跃频道
2. `createIssueFunctionTools()`、`createCommandFunctionTools()`、`createDatabaseFunctionTools()`、`createKanbanFunctionTools()` 返回启用的内置工具
3. 工具通过 `functionTools` 传递给 `runtime.execute()`
4. 运行时适配器通过其原生工具协议暴露工具
5. 模型调用 function tool
6. 服务端执行 `AgentFunctionTool.execute(input)`
7. 运行时发出 `tool_use` / `tool_result` 事件
8. WebSocket 处理器存储工具详情并广播更新后的频道/Issue 状态

## UI 展示

聊天输入框的 `Tools` 菜单展示内置 Issue 工具：

```text
packages/web/src/components/chat/chat-input.tsx
```

这些入口在所有频道中可见，但仅在当前频道为绑定了 `issueId` 的 Issue 频道时才可用（否则禁用）。

UI 仅作为能力指示器。实际的授权和作用域限制在服务端强制执行。

## 校验规则

内置 Issue 工具在服务层强制执行校验：

- 输入必须是对象
- `input.issueId` 必须等于 `channel.issueId`
- 绑定的 Issue 必须存在

即使模型或客户端发送格式错误的工具输入，信任边界仍保持在服务端。

## 内置 Kanban 工具

Kanban 工具位于：

```text
packages/server/src/services/builtin-tools/kanban-tools.ts
```

工具列表：

- `ListKanbanBoards`
- `ViewKanbanBoard`
- `CreateKanbanBoard`
- `UpdateKanbanBoard`
- `DeleteKanbanBoard`

这些工具操作当前 workspace 的看板数据，底层存储为：

```text
packages/server/src/storage/kanban-store.ts
```

当前产品语义是每个 workspace 一个 Kanban board。工具层仍支持传入 `boardId` 来查看、更新或删除明确的 board，以兼容历史重复数据。

重要约束：

- 创建看板前应先调用 `ListKanbanBoards`，已有看板时使用 `UpdateKanbanBoard`
- `UpdateKanbanBoard` 修改 `columns` 或 `tasks` 时使用完整数组替换
- `tasks[].columnId` 必须指向现有 column
- 删除看板会同时删除该看板的 columns 和 tasks

## MCP 工具命名规则

`AgentFunctionTool.name` 是服务端内部的逻辑工具名，例如 `ListDatabaseNodes`、`WriteDatabaseNode`、`CreateDatabaseNode`。

在 Claude Code 运行时中，这些工具通过 SDK MCP Server 暴露。服务端注册的 MCP Server 名称是 `agent-spaces`，Claude Code 模型实际可调用的工具名不是裸工具名，而是：

```text
mcp__<server-name>__<tool-name>
```

因此 Agent Spaces 内置工具在 Claude Code 中的实际调用名示例为：

```text
mcp__agent-spaces__ListDatabaseNodes
mcp__agent-spaces__SearchDatabaseNodes
mcp__agent-spaces__CreateDatabaseNode
mcp__agent-spaces__WriteDatabaseNode
mcp__agent-spaces__ReadDatabaseNode
mcp__agent-spaces__ListKanbanBoards
mcp__agent-spaces__ViewKanbanBoard
mcp__agent-spaces__UpdateKanbanBoard
```

注意：
- Prompt 中如果只写 `ListDatabaseNodes`，模型可能会尝试裸名调用，并得到 `No such tool available: ListDatabaseNodes`。
- 给模型的运行时提示应尽量写实际可调用名 `mcp__agent-spaces__ListDatabaseNodes`。
- 服务端事件处理和工具日志匹配也要兼容 `mcp__agent-spaces__...`，不能只匹配 `agent-spaces.ToolName` 或裸工具名。

## 本次数据库工具踩坑总结

### 1. 工具描述不能替代真实注册

Function-call 工具必须真实加入 `runtime.execute(..., { functionTools })`。如果只在 prompt 中描述工具，模型会以为工具存在，但运行时会返回：

```text
No such tool available
```

检查点：
- `packages/server/src/services/builtin-tools.ts` 是否创建了 `AgentFunctionTool`
- `packages/server/src/ws/agent-runner.ts` 是否把工具加入 `functionTools`
- `packages/shared/src/types/tool.ts` 是否加入 `BUILT_IN_AGENT_TOOLS`
- Agent 配置里的 `tools` 是否启用了对应工具

### 2. Claude Code 原生工具和 Agent Spaces 工具容易混淆

Claude Code 自带 `Write` 工具，参数是文件系统语义，例如 `file_path`。

Agent Spaces 知识库写入工具是：

```text
mcp__agent-spaces__WriteDatabaseNode
```

参数是知识库语义，例如：

```json
{
  "id": "existing-node-id",
  "mode": "overwrite",
  "content": "..."
}
```

如果模型把 `{ id, content }` 传给 Claude Code 原生 `Write`，会出现：

```text
InputValidationError: file_path expected string
```

Prompt 必须明确：
- 知识库/database 文档不是 workspace 文件
- 写知识库必须调用 `mcp__agent-spaces__WriteDatabaseNode`
- 不要用 Claude Code 原生 `Write` 写知识库内容

### 3. 写入工具不能兼任创建工具

`WriteDatabaseNode` 只能写已有节点。空知识库或目标文档不存在时，模型如果猜测 `documents`、`knowledge-base`、`0001` 等 id，会得到：

```text
Database node not found
```

应提供独立创建工具：

```text
mcp__agent-spaces__CreateDatabaseNode
```

推荐流程：

1. `mcp__agent-spaces__ListDatabaseNodes` 查看目标路径。
2. 如果目标不存在，调用 `mcp__agent-spaces__CreateDatabaseNode` 创建节点，由服务端生成真实 `id`。
3. 后续更新已有节点时，再调用 `mcp__agent-spaces__WriteDatabaseNode`。

### 4. 新增工具要考虑旧 Agent 配置

Agent 的 `tools` 是可配置白名单。新增工具后，旧 Agent 配置可能没有这个工具名，即使代码里实现了工具，也不会暴露给该 Agent。

处理方式应按语义决定：
- 如果是全新能力，要求用户在 Agent 配置中勾选。
- 如果是既有能力的必要补充，例如数据库工具集中的 `CreateDatabaseNode`，可以在数据库工具集合启用时自动补齐该工具，避免旧配置造成能力残缺。

### 5. Prompt 中要写操作流程，而不只是参数

仅写 `WriteDatabaseNode(id, content)` 不够。模型在空库场景下会尝试猜 id。

数据库工具提示应包含流程约束：
- 不知道 id 时先 list/search
- 空库或目标不存在时 create
- 已有节点才 write
- 移动时校验目标 parent/path
- 删除目录时服务端负责递归处理

### 6. 服务端仍是信任边界

即使 prompt 写了规则，也不能依赖模型遵守。服务端工具必须做校验：
- 输入必须是对象
- `id` 必须存在
- `replace` 模式必须找到被替换文本
- move 不能移动到自身或后代
- delete 目录需要处理子节点
- path 解析失败要返回明确错误
