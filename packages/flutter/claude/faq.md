[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/faq.md**

# 常见问题

## 连接与通信

**Q: Flutter 客户端如何连接后端？**
A: 两种方式：
1. 内网发现 -- 首页 `HomePage` 检测本地 InAppLocalhostServer（8080 端口）和后端健康检查接口（`/api/health`）
2. 手动输入 -- 用户在首页输入服务器地址

**Q: WebView 如何与 Flutter 原生层通信？**
A: 通过 `JsBridge`。WebView 端注入 `window.__flutterBridge` 对象，支持 `emit`（单向事件）和 `invoke`（双向 RPC，返回 Promise）。Flutter 端通过 `addJavaScriptHandler` 接收，通过 `evaluateJavascript` 回调。

**Q: 如何区分 Flutter 和 Tauri 环境？**
A: JS Bridge 注入时设置 `window.isFlutterEnvironment() = true` 和 `window.isTauriEnvironment() = false`。

## Tab 系统

**Q: 支持哪几种 Tab 类型？**
A: 三种：`webview`（WebView 浏览器）、`terminal`（SSH 终端）、`fileSource`（文件源管理器）。

**Q: 设备模拟如何工作？**
A: `DeviceProfile` 定义三种设备尺寸和 User-Agent。非 Desktop 模式时，WebView 被约束在固定尺寸的 Container 中（带边框和阴影），模拟移动端视口。

**Q: 分屏布局如何实现？**
A: 使用 `docking` 库实现 Docking 风格的 Tab 布局。支持 5 种分屏模式（single/horizontal2/vertical2/horizontal3/quad），布局状态可持久化和恢复。Tab 可拖拽重排。

## 文件源

**Q: 文件源支持哪些协议？**
A: SFTP、FTP、本地存储（Storage）、WebDAV 四种。

**Q: FTP 为什么不支持 Copy？**
A: `ftpconnect` 库没有提供直接复制 API。

**Q: WebDAV 连接常见错误？**
A: WebDAV FileSource 会在错误信息中提示常见问题，例如 Base URL 指向普通 HTTP 页面而非 WebDAV 端点（PROPFIND 返回 200 而非 207）、认证失败（401/403）等。

## 持久化

**Q: 数据存在哪里？**
A: 所有数据通过 SharedPreferences 存储。桌面端路径取决于操作系统（如 Windows 上在 `%APPDATA%` 下）。

**Q: 窗口状态如何持久化？**
A: 桌面端通过 `window_manager` + SharedPreferences 保存窗口位置、大小、最大化/全屏状态，下次启动时恢复。

## 国际化

**Q: 支持哪些语言？**
A: 中文（zh）和英文（en），使用 `easy_localization`。翻译文件在 `assets/translations/` 目录下。

## 终端

**Q: SSH 终端支持哪些认证方式？**
A: 密码认证和私钥认证（PEM 格式，可选口令）。

**Q: 虚拟键盘如何工作？**
A: `TerminalVirtualKeyboard` 提供屏幕键盘，支持 Ctrl/Alt/Shift 修饰键，发送对应的转义序列和 Ctrl 字符。
