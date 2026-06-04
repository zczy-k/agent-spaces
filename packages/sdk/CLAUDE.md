[根目录](../../CLAUDE.md) > [packages](../) > **sdk**

# @agent-spaces/sdk

## 模块职责

前端 API 统一调用包。提供类型安全的 HTTP 客户端封装（HttpClient），按功能域拆分为 34 个 API 模块适配器，覆盖 Agent Spaces 平台全部 REST API。web 包通过 `lib/sdk.ts` 单例消费，自动注入 Bearer Token 和服务器地址。

## 入口与启动

- **入口文件**：`src/index.ts` — 导出 `createSDK()` 工厂函数和所有模块工厂
- **构建命令**：`pnpm build`（tsc 编译到 dist/）
- **消费方式**：web 包 `src/lib/sdk.ts` 创建单例，组件通过 `sdk.xxx.method()` 调用

## 架构

```
createSDK(config)
  └── HttpClient (baseUrl + token + onUnauthorized)
        ├── workspace     ├── agent          ├── channel
        ├── issue         ├── task           ├── git
        ├── editor        ├── llm            ├── workflow
        ├── workflowPlugin├── kanban         ├── database
        ├── worktree      ├── hooks          ├── command
        ├── subscription  ├── notification   ├── speech
        ├── codeFavorites ├── prompts        ├── skills
        ├── mcps          ├── outputStyles   ├── tools
        ├── robotAccounts ├── auth           ├── data
        ├── version       ├── search         ├── agentStore
        ├── font          ├── inspector      ├── avatar
        └── agentCommands
```

### HttpClient 核心方法

| 方法 | 用途 |
|------|------|
| `get<T>()` | GET + JSON 解析 |
| `post<T>()` | POST JSON + 解析 |
| `postVoid()` | POST 不解析响应 |
| `put<T>()` / `putVoid()` | PUT JSON |
| `delete()` / `deleteOf<T>()` | DELETE |
| `upload<T>()` | FormData 上传 |
| `sse()` | SSE 流式响应 |
| `raw()` | 原始 Response |

### 模块工厂模式

每个模块遵循统一模式：

```typescript
export function createXxxApi(http: HttpClient) {
  return {
    method: (): Promise<Type> => http.get('/api/xxx'),
    methodWithBody: (data: Type): Promise<Type> => http.post('/api/xxx', data),
  };
}
```

## 依赖

- `@agent-spaces/shared`（workspace:*）— 共享类型定义

## 文件清单

| 文件 | 职责 |
|------|------|
| `src/client.ts` | HttpClient 封装（baseUrl + Bearer Token + 错误处理 + 调试日志） |
| `src/types.ts` | SDK 内部类型（SDKConfig, RequestOptions, PromptTemplate 等） |
| `src/index.ts` | 工厂函数 createSDK()，注册 34 个 API 模块 |
| `src/modules/*.ts` | 34 个 API 模块适配器 |

## 关键设计

- **自动认证**：HttpClient 自动注入 Bearer Token，401/403 触发 `onUnauthorized` 回调
- **调试模式**：`setDebug(true)` 输出请求/响应日志
- **服务器切换**：SDK 单例通过 Proxy 动态获取最新 baseUrl，支持运行时切换服务器
- **类型安全**：所有 API 方法和返回值完整类型化，类型从 `@agent-spaces/shared` 导入
