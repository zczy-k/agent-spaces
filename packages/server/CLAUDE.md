[根目录](../../CLAUDE.md) > [packages](../) > **server**

# @agent-spaces/server

Express 5 后端服务，173 个 TypeScript 源文件。提供 REST API（37 个路由文件）、WebSocket 实时通信（3 个端点）、认证中间件、六运行时 Agent 编排引擎、Workflow DAG 执行引擎（1757 行）、Plugin 插件系统、通知中心（飞书/企微/Native）、Hook 系统、PTY 终端、Git 操作、SQLite Agent Usage 统计。作为整个平台的核心运行时，管理 Workspace 生命周期、Issue/Task 状态机、Agent 会话调度和数据持久化。

## 约定的规则

- ESM 模块（`"type": "module"`）
- 路由文件放在 `src/routes/`，按资源分组
- 服务层文件放在 `src/services/`
- 存储层文件放在 `src/storage/`
- 适配器文件放在 `src/adapters/`
- JSON body 限制 50MB
- zod 用于后端请求校验
- 除健康检查/认证/Inspector/版本端点外均需 Bearer Token 认证
- WebSocket 认证通过 `token` 查询参数

## 文件索引

| 文件 | 说明 |
|------|------|
| [claude/overview.md](claude/overview.md) | 总览、核心架构、大文件列表 |
| [claude/route-index.md](claude/route-index.md) | 37 个 REST API 路由索引 |
| [claude/architecture.md](claude/architecture.md) | Agent 运行时架构、Workflow 引擎、Issue 自动化、通知中心 |
| [claude/changelog.md](claude/changelog.md) | 变更记录 |

## 入口与启动

- **入口文件**：`src/app.ts`（435 行）
- **启动命令**：`pnpm dev`（tsx watch）或 `pnpm start`
- **默认端口**：3100（PORT 环境变量）
- **数据目录**：`~/.agent-spaces-data`

## 关键目录

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `src/routes/` | 37 | REST API 路由 |
| `src/services/` | 50+ | 业务逻辑（含子目录） |
| `src/storage/` | 20+ | 持久化层 |
| `src/adapters/` | 16 | Agent 运行时 + Git |
| `src/agents/` | 10 | Agent 编排 |
| `src/ws/` | 8 | WebSocket 处理 |

## 扫描状态

- **更新时间**：2026-06-09 11:04:09
- **已扫描范围**：全部路由、服务、适配器、存储层、WebSocket 处理器
- **覆盖率**：约 90%
