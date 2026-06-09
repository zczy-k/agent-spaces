[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/overview.md**

# 项目总览

## 核心定位

Flutter 模块是 Agent Spaces 的**原生多平台客户端外壳**。它不是一个独立应用，而是一个 WebView 壳应用 + 原生增强层。业务逻辑全部在 Web 前端（packages/web）和服务端（packages/server）中。

除了 WebView 浏览器功能外，还提供了以下独立于 WebView 的原生功能：

1. **SSH 终端** -- 通过 dartssh2 实现 SSH 连接，带完整的虚拟键盘和终端工具栏
2. **文件源管理器** -- 统一文件树界面，支持 SFTP、FTP、本地存储、WebDAV 四种协议
3. **Docking 分屏布局** -- 基于 docking 库实现可拖拽的 Tab 分屏

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Flutter SDK | ^3.10.1 | 跨平台 UI 框架 |
| Dart | (随 Flutter) | 编程语言 |
| flutter_riverpod | ^2.6.1 | 状态管理（StateNotifierProvider） |
| go_router | ^14.8.1 | 声明式路由 |
| flutter_inappwebview | ^6.1.5 | WebView 引擎 |
| awesome_notifications | ^0.11.0 | 本地通知 |
| dartssh2 | ^2.17.1 | SSH 客户端 |
| xterm | ^4.0.0 | 终端 UI |
| docking | ^1.16.2 | Docking 分屏布局 |
| webdav_client | ^1.2.2 | WebDAV 客户端 |
| ftpconnect | ^2.0.10 | FTP 客户端 |
| animated_tree_view | ^2.3.0 | 文件树 UI |
| easy_localization | ^3.0.8 | 国际化（中/英） |
| adaptive_theme | ^3.7.2 | 主题切换（明/暗/系统） |
| window_manager | ^0.5.1 | 桌面窗口管理 |
| shared_preferences | ^2.5.3 | KV 持久化 |
| upgrader | ^13.3.0 | 版本升级检测 |

## 架构分层

```
main.dart (入口 + 路由)
  |
  +-- screens/       (页面层：7 个页面)
  |     +-- widgets/   (组件层：15 个组件)
  |           +-- services/ (服务层：3 个服务 + file_sources 子目录)
  |
  +-- providers/     (状态管理层：6 个 Provider)
  |     +-- models/   (数据模型层：5 个模型)
  |
  +-- bridge/        (通信层：JS Bridge)
```

## 核心数据流

```
用户操作 -> Screen/Widget -> Provider (StateNotifier) -> State 更新 -> UI 重建
                                         |
                                         +-> StorageService -> SharedPreferences 持久化
```

## 运行环境

- 目标平台：Android / iOS / macOS / Windows / Web
- 桌面端使用 window_manager 管理窗口状态（位置/大小/最大化/全屏），启动时恢复
- 移动端使用 InAppWebView 加载 Web 前端
- 通过 `window.isFlutterEnvironment()` / `window.isTauriEnvironment()` 让 Web 前端检测运行环境
