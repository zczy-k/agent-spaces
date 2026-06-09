# 常见问题 (FAQ)

## 开发环境

**Q: 如何启动开发环境？**
A: `pnpm install && pnpm dev`。server 运行在 3100 端口，web 运行在 3000 端口。

**Q: 构建顺序是什么？**
A: shared -> sdk -> server -> web。`pnpm build` 已按正确顺序编排。

**Q: node-pty 编译失败怎么办？**
A: 运行 `npx node-gyp rebuild --directory=node_modules/node-pty`，需要编译工具链。

## 认证

**Q: Secret Key 在哪里设置？**
A: 首次访问登录页时输入，存储在 `~/.agent-spaces-data/auth.json`。默认为空（无需认证）。

**Q: WebSocket 如何认证？**
A: 连接时通过 `token` 查询参数验证。

## Agent 运行时

**Q: 有哪些 Agent 运行时？**
A: 6 种 -- open-agent-sdk（默认）、claude-code、codex、langchain、hermes、oh-my-pi。

**Q: 如何选择运行时？**
A: 在 Agent Preset 中设置 `runtimeKind` 字段。

**Q: Anthropic Bridge 是什么？**
A: ClaudeCodeRuntime 内置的协议中转层，让 Claude Code SDK 调用 OpenAI API。详见 `docs/anthropic-bridge.md`。

## Workflow

**Q: Workflow 如何与 Issue 关联？**
A: Issue 的 `workflowId` 字段绑定 Workflow 模板。详见 `docs/workflow-system.md`。

**Q: Workflow 执行引擎在哪？**
A: `packages/server/src/services/execution-manager.ts`（1757 行），支持 DAG 遍历/循环/分支/变量/断点/恢复。

## 数据存储

**Q: 数据存在哪里？**
A: 默认 `~/.agent-spaces-data/`。Agent Session/Usage 使用 SQLite，其余为 JSON 文件。

**Q: 如何修改数据目录？**
A: 设置 `AGENT_SPACES_DATA_DIR` 环境变量。

## 前端

**Q: Next.js 16 有什么不同？**
A: 详见 `packages/web/AGENTS.md`，API 和文件结构可能有 Breaking Changes。

**Q: API 请求为什么不需要完整 URL？**
A: `next.config.ts` 中配置了 rewrites，将 `/api/*` 代理到后端。

**Q: FlexLayout 布局如何自定义？**
A: 修改 `workspace-shell.tsx` 中的默认配置，或使用 Layout Manager Dialog 保存/加载模板。

## i18n

**Q: 如何切换中英文？**
A: Settings 对话框中选择 Language。翻译文件在 `src/locales/{en,zh}/`，按命名空间拆分。

**Q: 如何添加新的翻译键？**
A: 在对应命名空间的 JSON 文件中添加，组件通过 `useTranslations('namespace')` 获取。
