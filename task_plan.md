# Task Plan: 创建 @agent-spaces/sdk 包

## 目标

从 `packages/web` 提取所有 `await fetch` 调用（73 文件 / 244 处），统一到 `packages/sdk` 包。
SDK 通过 pnpm workspace 本地关联，提供统一 HTTP 客户端、标准化错误处理、调试日志。

## 设计原则

1. **单一 HTTP 客户端**：所有请求经过 `client.ts` 统一处理（auth/URL/错误/日志）
2. **按领域分模块**：每个 API 领域一个文件（workspace/agent/channel/issue/git...）
3. **统一入口出口**：`index.ts` 导出所有 API + `createSDK()` 工厂
4. **可调试**：全局 `DEBUG` 开关，打印请求/响应/耗时
5. **零框架依赖**：纯 TypeScript，不依赖 next/react

## 现状分析

| 类别 | 数量 | 说明 |
|------|------|------|
| 已用 `fetchWithAuth()` | ~70 | `lib/auth.ts` 提供 auth + URL + 401 重定向 |
| 裸 `fetch()` | ~174 | 依赖 `api-polyfill.ts` 全局 patch，无 auth/错误标准化 |
| `fetchStoreIndex()` | ~1 | `lib/agent-store.ts`，外部 GitHub API |
| **总计** | **244 / 73 文件** | |

## SDK 架构

```
packages/sdk/
  package.json          # @agent-spaces/sdk
  tsconfig.json
  src/
    index.ts            # 统一导出 + createSDK()
    client.ts           # HttpClient 核心
    types.ts            # SDK 通用类型
    modules/
      workspace.ts      # 工作空间 CRUD
      agent.ts          # Agent 预设
      channel.ts        # 频道/消息
      issue.ts          # 议题
      task.ts           # 任务
      git.ts            # Git 操作
      editor.ts         # 文件/编辑器
      llm.ts            # LLM 模型/供应商
      workflow.ts       # Workflow 模板/执行/版本
      workflow-plugin.ts # Workflow 插件
      kanban.ts         # 看板
      database.ts       # 文档数据库
      worktree.ts       # Worktree
      hooks.ts          # Hook 管理
      command.ts        # 快捷命令
      subscription.ts   # 订阅余额
      notification.ts   # 应用内通知
      speech.ts         # 语音识别配置
      code-favorites.ts # 代码收藏
      prompts.ts        # Prompt 模板
      skills.ts         # 技能管理
      mcps.ts           # MCP 配置
      output-styles.ts  # 输出风格
      tools.ts          # 内置工具
      robot-accounts.ts # Robot Account
      auth.ts           # 登录/认证
      data.ts           # 数据导入/导出
      version.ts        # 版本检查
      search.ts         # 代码搜索
      agent-store.ts    # Agent Store 在线导入
      font.ts           # 字体管理
      inspector.ts      # DOM Inspector
      avatar.ts         # 头像上传
```

## Phases

### Phase 1 — SDK 基础设施 [pending]
- [ ] 创建 `packages/sdk` 包骨架（package.json / tsconfig.json）
- [ ] 实现 `client.ts`：HttpClient 类（auth/URL/错误/日志）
- [ ] 实现 `types.ts`：通用类型
- [ ] 实现 `index.ts`：createSDK() 工厂
- [ ] 配置 pnpm workspace 关联
- [ ] 验证：`pnpm install` + `pnpm --filter @agent-spaces/sdk build` 通过

### Phase 2 — 核心 API 模块 [pending]
- [ ] 实现 ~30 个 modules/*.ts 文件
- [ ] 每个模块从 web 中提取对应 fetch 调用
- [ ] 统一返回类型和错误处理
- [ ] 验证：build 通过

### Phase 3 — Web 集成 [pending]
- [ ] web package.json 添加 `@agent-spaces/sdk` 依赖
- [ ] 迁移 `lib/auth.ts` 的 `fetchWithAuth` → SDK client
- [ ] 迁移 `lib/api-polyfill.ts` → SDK client 内置
- [ ] 迁移 stores 中的 fetch 调用
- [ ] 迁移 components 中的 fetch 调用
- [ ] 迁移 hooks 中的 fetch 调用
- [ ] 迁移 app pages 中的 fetch 调用
- [ ] 清理：删除 `lib/api-polyfill.ts`、`lib/auth.ts` 中不再需要的代码
- [ ] 验证：`pnpm dev` + 手动测试主要功能

### Phase 4 — 验证与清理 [pending]
- [ ] 全量 TypeScript 编译通过
- [ ] 确认无残留的裸 fetch 调用（除了 SDK 内部）
- [ ] 验证调试日志输出

## 关键文件影响

### stores/ (11 文件, ~75 fetch)
- `git.ts` (26), `channel.ts` (10), `issue.ts` (9), `editor.ts` (8), `task.ts` (7), `agent.ts` (2), `llm.ts` (2)
- `workflow.ts`, `kanban.ts`, `worktree.ts`, `hooks.ts`, `notification.ts`, `command.ts`, `code-favorites.ts`, `database.ts`

### lib/ (6 文件)
- `auth.ts`, `api-polyfill.ts`, `server.ts`, `agent-store.ts`, `workflow-api.ts`, `workflow-plugin-api.ts`

### components/ (~52 文件, ~140 fetch)
- 最重的：`use-skills-data.ts` (14), `mcps-dialog.tsx` (10), `prompts-dialog.tsx` (9), `output-styles-dialog.tsx` (8)

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
