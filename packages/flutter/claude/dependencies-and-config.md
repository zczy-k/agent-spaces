[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/dependencies-and-config.md**

# 依赖与配置

## 依赖关系图

本模块不依赖 `packages/shared` 或 `packages/server`，是完全独立的 Flutter 客户端。

```
main.dart
  -> providers/*（初始化所有 Provider）
  -> screens/*（GoRouter 路由目标）

screens/home_screen.dart
  -> providers/browser_provider, providers/settings_provider
  -> widgets/webview_panel
  -> services/notification_service, services/storage_service, services/webview_service

widgets/webview_panel.dart
  -> widgets/home_page, widgets/split_layout
  -> providers/browser_provider, providers/settings_provider

widgets/split_layout.dart
  -> widgets/webview_instance, widgets/terminal_instance, widgets/file_source_tree
  -> widgets/tab_context_menu, widgets/tab_widgets
  -> providers/browser_provider
  -> (docking 库)

widgets/webview_instance.dart
  -> bridge/js_bridge
  -> providers/browser_provider, providers/console_log_provider, providers/settings_provider
  -> services/webview_service, services/notification_service
  -> models/browser_tab

widgets/terminal_instance.dart
  -> providers/browser_provider, providers/terminal_credentials_provider
  -> widgets/terminal_login_form, widgets/terminal_toolbar, widgets/terminal_virtual_keyboard
  -> models/browser_tab, models/terminal_credential
  -> (dartssh2, xterm 库)

widgets/file_source_tree.dart
  -> services/file_sources/file_source_factory, services/file_sources/path_utils
  -> services/notification_service
  -> models/file_source_config
  -> (animated_tree_view, desktop_drop, file_selector 库)

services/file_sources/*
  -> models/file_source_config
  -> services/file_sources/path_utils, services/file_sources/file_source
  -> (dartssh2, ftpconnect, webdav_client 库)

providers/*
  -> models/*, services/storage_service

screens/bookmarks_screen.dart
  -> providers/bookmark_provider, providers/browser_provider
  -> models/bookmark, models/browser_tab

screens/settings_screen.dart
  -> providers/settings_provider
  -> services/notification_service, services/webview_service

screens/terminal_credentials_screen.dart
  -> providers/terminal_credentials_provider
  -> models/terminal_credential

screens/file_source_credentials_screen.dart
  -> providers/file_source_credentials_provider
  -> models/file_source_config, models/file_source_credential
  -> services/file_sources/webdav_url
```

## 关键依赖

| 包 | 用途 |
|---|------|
| flutter_inappwebview | WebView 引擎 + InAppLocalhostServer |
| flutter_riverpod / riverpod_annotation | 状态管理 |
| go_router | 声明式路由 |
| dartssh2 | SSH 客户端 |
| xterm | 终端 UI 组件 |
| docking | Docking 分屏布局 |
| webdav_client | WebDAV 协议客户端 |
| ftpconnect | FTP 协议客户端 |
| animated_tree_view | 文件树 UI |
| awesome_notifications | 本地推送通知 |
| shared_preferences | KV 持久化 |
| easy_localization | 国际化 |
| adaptive_theme | 主题切换 |
| window_manager | 桌面窗口管理 |
| upgrader | 版本升级检测 |
| file_selector | 文件/目录选择器 |
| desktop_drop | 桌面拖拽上传 |
| url_launcher | 外部链接 |
| share_plus | 分享 |
| uuid | 唯一 ID 生成 |

## 构建配置

### pubspec.yaml 关键配置

- `publish_to: 'none'` -- 不发布到 pub.dev
- `sdk: ^3.10.1` -- Flutter SDK 版本要求
- `assets/web/` -- 内嵌 Web 前端静态资源（Monaco 编辑器等）
- `assets/translations/` -- 国际化翻译文件

### analysis_options.yaml

- 使用 `flutter_lints/flutter.yaml` 规则集
- 未自定义额外 lint 规则

### 平台配置

- `flutter_launcher_icons` -- 多平台应用图标生成
- 支持平台：Android / iOS / macOS / Windows / Web
- Android min_sdk: 21
