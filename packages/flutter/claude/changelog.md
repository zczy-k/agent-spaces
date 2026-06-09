[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/changelog.md**

# 变更记录

## 2026-06-09 -- 全量重新扫描

**触发原因**：发现旧 CLAUDE.md 记录的源文件数（21 个）与实际（44 个）差距较大，需要进行全面更新。

**扫描结果**：

- 旧记录未覆盖的功能：SSH 终端（TerminalInstance + dartssh2 + xterm）、文件源管理器（FileSource 抽象 + SFTP/FTP/Storage/WebDAV 四种实现）、Docking 分屏布局（docking 库集成）、i18n（easy_localization 中/英）、主题切换（adaptive_theme 明/暗/系统）、桌面窗口状态管理（window_manager）、虚拟键盘、控制台日志面板、终端凭据管理、文件源凭据管理等
- 新增模型：`TerminalCredential`、`FileSourceConfig`、`FileSourceCredential`
- 新增 Provider：`terminalCredentialsProvider`、`fileSourceCredentialsProvider`
- 新增枚举：`BrowserTabType`、`SplitLayout`、`FileSourceType`
- `BrowserTab` 扩展了 `type`、`fileSourceConfig`、`terminalCredential` 字段
- `AppSettings` 扩展了 `restoreLayoutOnStartup`、`webViewDebuggingEnabled`、`incognito` 字段
- `BrowserState` 扩展了 `splitLayout`、`savedDockingLayout` 字段
- 路由从 4 条扩展到 7 条（新增终端凭据页、文件源凭据页）
- 首页从"三级内网扫描"简化为"本地 Web 检测 + 手动输入"
- 新增 InAppLocalhostServer 本地 Web 服务器

**产物**：

- 更新 `packages/flutter/CLAUDE.md`
- 新建 `packages/flutter/claude/overview.md`
- 新建 `packages/flutter/claude/conventions.md`
- 新建 `packages/flutter/claude/module-responsibilities.md`
- 新建 `packages/flutter/claude/entrypoints.md`
- 新建 `packages/flutter/claude/public-interfaces.md`
- 新建 `packages/flutter/claude/dependencies-and-config.md`
- 新建 `packages/flutter/claude/data-model.md`
- 新建 `packages/flutter/claude/testing-and-quality.md`
- 新建 `packages/flutter/claude/file-map.md`
- 新建 `packages/flutter/claude/faq.md`
- 新建 `packages/flutter/claude/changelog.md`
