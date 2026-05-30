# LangChain Agent Runtime

本文档记录 Agent Spaces 当前 `langchain` runtime 的实现边界、配置映射、工具接入、MCP 接入、日志输出和排障要点。

相关实现：

- `packages/server/src/adapters/langchain-runtime.ts`
- `packages/server/src/adapters/agent-runtime-types.ts`
- `packages/server/src/ws/agent-runner.ts`
- `packages/server/src/ws/agent-prompt.ts`
- `packages/server/test/langchain-runtime.test.ts`

## 当前定位

`LangChainRuntime` 是进程内运行的 LangChain.js 适配器，实现统一的 `AgentRuntime` 接口。

它不启动 CLI 子进程，而是在 server 进程内完成：

- 通过 `initChatModel()` 初始化 LangChain chat model。
- 通过 `createAgent()` 创建 LangChain agent。
- 将 Agent Spaces 内置 function tools 转成 LangChain tools。
- 通过 `@langchain/mcp-adapters` 加载当前 Agent 配置的 MCP tools。
- 将最终文本、工具事件、用量信息回写到 Agent Spaces runtime 事件流。

运行入口是：

```ts
runtime.execute(agentPrompt, workingDir, {
  maxTurns,
  functionTools,
  mcpServers,
  skills,
  sandboxDirs,
  outputStyle,
  onEvent,
})
```

## Provider 和模型解析

LangChain 使用 `provider:model` 形式选择具体模型实现。当前映射逻辑集中在 `resolveLangChainModelSettings()`：

| Agent Spaces provider | LangChain provider |
| --- | --- |
| `anthropic-messages` | `anthropic` |
| `openai-chat-completions` | `openai` |
| `openai-responses` | `openai` |
| `gemini-generate-content` | `google-genai` |

模型名会先去掉已有的 LangChain provider 前缀，再重新拼成 resolved provider：

```text
anthropic:claude-sonnet-4-6 -> anthropic:claude-sonnet-4-6
openai:gpt-4o-mini -> openai:gpt-4o-mini
```

### 智谱 OpenAI 兼容地址纠偏

智谱 `https://open.bigmodel.cn/api/paas/v4` 是 OpenAI-compatible API。历史配置里可能出现：

```text
provider=anthropic-messages
model=anthropic:GLM-4.7
baseURL=https://open.bigmodel.cn/api/paas/v4
```

这种配置如果直接走 Anthropic SDK，会返回 `403 Request not allowed`。当前 runtime 会根据 `baseURL` 识别 `open.bigmodel.cn` 或 `*.bigmodel.cn`，将 LangChain provider 从 `anthropic` 纠偏为 `openai`，最终模型标识变为：

```text
openai:GLM-4.7
```

控制台会输出：

```text
[langchain] provider adjusted | baseURL=... is OpenAI-compatible, using openai instead of anthropic
```

## 模型配置和环境变量

`buildModelConfig()` 会把以下字段传给 LangChain model：

- `apiKey`
- `api_key`
- `baseURL`
- `baseUrl`
- `configuration.baseURL`

同时 `buildProviderEnv()` 会在 `initChatModel()` 调用期间临时设置 provider 对应环境变量：

| LangChain provider | 环境变量 |
| --- | --- |
| `openai` | `OPENAI_API_KEY`, `OPENAI_BASE_URL` |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` |
| `google-genai` | `GOOGLE_API_KEY`, `GEMINI_API_KEY` |

环境变量只在初始化模型期间临时写入，完成后恢复原值，避免污染 server 进程后续请求。

## Prompt 和输出风格

`agent-prompt.ts` 会把 workspace prompt、runtime configuration、历史消息和用户消息组合成最终 prompt。

对于 LangChain runtime，prompt 中会说明：

```text
Runtime tools available through LangChain: Agent Spaces function tools and configured MCP tools
```

用户选择的 output style 会通过 `appendOutputStyleToPrompt()` 追加到 user message，作为 LangChain agent 的输入消息内容。

## Agent Spaces Function Tools

`buildLangChainTools()` 会把 `AgentRunOptions.functionTools` 转成 LangChain tools：

- tool name 使用 Agent Spaces 原始工具名，例如 `CreateCurrentChannelIssue`。
- description 使用 `AgentFunctionTool.description`。
- schema 当前使用 `z.object({}).passthrough()`，允许模型传入工具定义需要的任意字段。
- 调用时执行 `AgentFunctionTool.execute(input)`。

每次工具调用会写入：

- 控制台日志：`[langchain] tool use | name=... input=...`
- runtime output：`Tool: <name> input=<json>`
- UI 事件：`tool_use`

工具成功后会写入：

- 控制台日志：`[langchain] tool result | name=... output=...`
- UI 事件：`tool_result`

工具失败时会写入：

```text
[langchain] tool error | name=... error=...
```

然后继续把异常抛给 LangChain agent。

## MCP Tools

LangChain runtime 使用 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 加载 MCP tools。

当前配置：

```ts
new MultiServerMCPClient({
  throwOnLoadError: true,
  prefixToolNameWithServerName: true,
  additionalToolNamePrefix: 'mcp',
  useStandardContentBlocks: false,
  outputHandling: 'content',
  mcpServers,
})
```

### 工具命名

MCP tool 会带 server 前缀，格式为：

```text
mcp__<serverName>__<toolName>
```

例如 `fetch` server 的 `fetch` 工具会暴露为：

```text
mcp__fetch__fetch
```

这能避免 MCP tools 与 Agent Spaces function tools 或不同 MCP server 之间重名。

### MCP 配置归一化

`normalizeLangChainMcpServers()` 支持两类 MCP server 配置。

HTTP / SSE：

```json
{
  "remote": {
    "url": "https://example.test/mcp",
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

会转为 LangChain MCP adapter 的 `http` transport。若配置里显式声明 `transport: "sse"` 或 `type: "sse"`，则使用 `sse` transport。

stdio：

```json
{
  "fetch": {
    "command": "uvx",
    "args": ["mcp-server-fetch"],
    "env": {
      "PYTHONIOENCODING": "utf-8"
    }
  }
}
```

会转为 `stdio` transport，并保留 `command`、`args`、`env`、`cwd`。

### fetch MCP 兼容转换

旧配置可能使用已退役的 npm 包：

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch", "--ignore-robots-txt"]
}
```

当前 runtime 会兼容转换为：

```json
{
  "command": "uvx",
  "args": ["mcp-server-fetch", "--ignore-robots-txt"],
  "env": {
    "PYTHONIOENCODING": "utf-8"
  }
}
```

这样可以继续支持现有 Agent 配置中的 `fetch` MCP。

## 工具结果字符串化

`stringifyToolResult()` 会把 function tool 和 MCP tool 的结果统一转成字符串：

- `string` 原样返回。
- `undefined` 返回 `"null"`。
- 对象和数组返回 pretty JSON。
- 循环引用等无法 JSON 序列化的结果回退到 `String(result)`。

这样做是为了兼容部分 OpenAI-compatible API。它们对 LangChain/OpenAI content block 的结构校验更严格，如果工具返回对象数组，可能报：

```text
400 messages[n].content[0].type:不能为空
```

因此当前实现强制让工具输出进入普通文本内容，避免 provider 把结构化 tool result 当成缺少 `type` 的 content block。

## 日志和 Runtime Events

启动时会输出一行完整摘要：

```text
[langchain] starting | cwd=... provider=... langchainProvider=... model=... baseURL=... maxTurns=... tools=... mcpServers=... sandboxDirs=...
```

MCP tools 加载成功后会输出：

```text
[langchain] resolved MCP tools | servers=fetch tools=mcp__fetch__fetch
```

工具调用过程会输出：

```text
[langchain] tool use | name=... input=...
[langchain] tool result | name=... output=...
[langchain] tool error | name=... error=...
[langchain] tool progress | name=... progress=...
[langchain] mcp message | server=... level=... data=...
```

运行成功会输出：

```text
[langchain] done <elapsed>ms | tokens=<totalTokens|unknown>
```

运行失败会输出：

```text
[langchain] failed <elapsed>ms | <error>
```

MCP client 会在 `finally` 中关闭：

```text
[langchain] MCP client closed
```

UI 侧主要依赖 `onEvent` 接收：

- `output`
- `tool_use`
- `tool_result`

## 返回结果

LangChain agent 执行完成后，runtime 会：

1. 从最后一条 AI message 提取最终文本。
2. 从 message metadata 中提取 token usage。
3. 将最终文本追加到 `output`。
4. 如果存在 usage，追加 `[Usage] tokens=... input=... output=...`。
5. 返回统一的 `AgentRunResult`。

当前不生成 artifacts：

```ts
{
  success: true,
  summary,
  artifacts: [],
  output,
  usage,
}
```

## 已知边界

- 当前实现没有 session resume。每次 `execute()` 都是一次新的 LangChain agent invocation。
- `throwOnLoadError: true` 表示 MCP server 加载失败会导致本次 LangChain run 失败。
- MCP 和 function tool 结果会被转成字符串，结构化结果不会原样作为 content block 传给模型。
- 当前 UI events 只展示通用 tool use/result，不完整渲染 MCP 的多模态或 resource content。
- `schema` 当前是 passthrough 对象，没有把每个 `AgentFunctionTool.inputSchema` 精确转换为 Zod schema。
- `maxTurns` 会映射为 LangChain `recursionLimit = max(2, maxTurns * 2 + 1)`，不是 provider 原生 turns 参数。

## 排障要点

### 智谱 GLM 报 403

检查日志中是否出现：

```text
langchainProvider=openai
provider adjusted | baseURL=... is OpenAI-compatible
model=openai:GLM-4.7
```

如果仍然显示 `langchainProvider=anthropic`，说明 `baseURL` 没有被识别为 OpenAI-compatible，或 provider/model 配置没有进入 LangChain runtime。

### 工具结果报 content type 为空

典型错误：

```text
400 messages[n].content[0].type:不能为空
```

检查工具结果是否经过 `stringifyToolResult()`。当前 function tools 和 MCP tools 都应返回字符串给 LangChain agent。

### 控制台看不到工具调用

检查是否出现：

```text
[langchain] tool use | name=...
[langchain] tool result | name=...
```

如果没有这些日志，说明模型没有发起工具调用，或工具没有被注册到 `createAgent({ tools })`。

### MCP fetch 没有实际执行

检查启动日志中是否有 `mcpServers=fetch`，以及后续是否有：

```text
[langchain] resolved MCP tools | servers=fetch tools=mcp__fetch__fetch
[langchain] tool use | name=mcp__fetch__fetch input=...
```

如果只看到最终回答，没有 `mcp__fetch__fetch` 工具调用日志，说明模型没有选择调用 MCP 工具，或者 prompt 没有明确要求使用 MCP。

### fetch MCP 启动失败

如果配置仍是旧 npm 包：

```text
npx -y @modelcontextprotocol/server-fetch
```

runtime 会自动转为：

```text
uvx mcp-server-fetch
```

因此运行环境需要可执行 `uvx`，并能安装或找到 `mcp-server-fetch`。

## 验证步骤

构建：

```powershell
pnpm --filter @agent-spaces/server build
```

定向测试：

```powershell
pnpm --filter @agent-spaces/server test -- langchain-runtime
```

手动验证 MCP fetch：

```text
@test [use mcp: fetch] 获取 https://gh-proxy.org/https://github.com/hunmer/agent-spaces/raw/refs/heads/main/packages/agents/mcps/index.json 的数据
```

预期日志至少包含：

```text
[langchain] resolved MCP tools | servers=fetch tools=mcp__fetch__fetch
[langchain] tool use | name=mcp__fetch__fetch input=...
[langchain] tool result | name=mcp__fetch__fetch output=...
```
