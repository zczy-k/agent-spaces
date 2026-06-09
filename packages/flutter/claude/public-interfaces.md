[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/public-interfaces.md**

# 对外接口

本模块是客户端应用，对外部系统暴露的接口只有 JS Bridge（WebView 内部通信）。不提供 HTTP 服务或 WebSocket 服务。

## JS Bridge API

`JsBridge` 类实现了 Flutter <-> WebView 的双向通信。在 WebView 中注入 `window.__flutterBridge` 对象。

### WebView 端可调用方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `emit(event, data)` | event: string, data: any | void | 向 Flutter 发送单向事件 |
| `invoke(method, args)` | method: string, args: any | Promise<any> | 向 Flutter 发送 RPC 调用，返回 Promise |
| `on(event, handler)` | event: string, handler: function | void | 注册从 Flutter 接收事件的处理器 |

### Flutter 端处理的 RPC 方法

在 `WebViewInstance` 的 `_handleBridgeInvoke` 中注册：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `setZoom` | `{ scale: number }` | number | 设置缩放（当前仅返回 scale 值） |
| `setFullscreen` | `bool` | bool | 设置全屏模式 |
| `sendNotification` | `{ title, body, id?, ongoing? }` | true | 发送原生通知 |
| `getNotificationPermission` | 无 | bool | 查询通知权限 |
| `requestNotificationPermission` | 无 | bool | 请求通知权限 |

### 环境检测函数

WebView 端可通过以下函数检测运行环境：

- `window.isFlutterEnvironment()` -- 返回 `true`
- `window.isTauriEnvironment()` -- 返回 `false`

### Flutter -> WebView 事件

通过 `emitToWebView(controller, event, data)` 从 Flutter 端向 WebView 发送事件，触发 WebView 端通过 `on` 注册的处理器。

## 路由表

GoRouter 定义的路由（供应用内导航使用，不对外暴露）：

| 路径 | 页面 |
|------|------|
| `/` | HomeScreen |
| `/bookmarks` | BookmarksScreen |
| `/settings` | SettingsScreen |
| `/settings/terminal-credentials` | TerminalCredentialsScreen |
| `/settings/file-source-credentials` | FileSourceCredentialsScreen |
| `/about` | AboutScreen |

## 服务器发现接口

`HomePage` 通过 `GET /api/health` 探测 Agent Spaces Server，匹配 `{"status":"ok"}` 即认为有效。`WebViewPanel` 额外检查前端服务器的 HTTP 200 响应。
