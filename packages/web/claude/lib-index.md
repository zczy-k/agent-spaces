# 工具库索引

`src/lib/` 下的工具库文件。

| 文件 | 说明 |
|------|------|
| `sdk.ts` | @agent-spaces/sdk 单例桥接层（自动同步 baseUrl + Bearer Token） |
| `ws.ts` | WebSocket 客户端（WorkspaceWS 类，自动重连） |
| `auth.ts` | 认证工具（getToken/setToken/isAuthenticated/fetchWithAuth） |
| `server.ts` | 多服务器管理（loadServers/getActiveServer） |
| `api-polyfill.ts` | API 请求 polyfill（自动添加活跃服务器前缀） |
| `navigate.ts` | 静态路由适配（Tauri 兼容） |
| `routes.ts` | 路径解析辅助 |
| `monaco-language-client.ts` | Monaco LSP 语言客户端 |
| `monaco-action-registry.ts` | Monaco Action 注册表 |
| `monaco-builtin-actions.ts` | 内置右键菜单 Action |
| `monaco-models.ts` | Monaco Model 缓存和预加载 |
| `monaco-loader.ts` | Monaco Editor 加载器配置 |
| `theme-style.ts` | Theme Style System（579 行） |
| `layout-templates.ts` | FlexLayout 布局模板管理 |
| `terminal-registry.ts` | 终端实例注册表 |
| `workflow-api.ts` | Workflow API 请求层 |
| `workflow-nodes.ts` | Workflow 节点类型工具 |
| `workflow-plugin-api.ts` | Workflow Plugin API 请求层 |
| `workflow-edge-id.ts` | Workflow Edge ID 工具 |
| `agent-members.ts` | Agent 成员工具 |
| `agent-store.ts` | Agent Store API 调用 |
| `commands.ts` | Slash 命令定义 |
| `converter.ts` | HTML 转 Markdown |
| `github.ts` | GitHub Contributions API |
| `native-notification.ts` | Native 通知（Tauri/Browser） |
| `users.ts` | 模拟用户数据 |
| `sample-logs.ts` | 示例日志数据 |
| `themes.ts` | JSON 颜色主题定义 |
| `ui-exports.ts` | UI 组件导出 |
| `utils.ts` | 通用工具函数 |
