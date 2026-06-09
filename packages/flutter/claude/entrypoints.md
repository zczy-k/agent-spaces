[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/entrypoints.md**

# 入口与启动

## 入口文件

`lib/main.dart` -- 应用唯一入口。

## 启动流程

1. `WidgetsFlutterBinding.ensureInitialized()` -- 初始化 Flutter 绑定
2. `EasyLocalization.ensureInitialized()` -- 初始化国际化
3. `NotificationService().initialize()` -- 初始化通知通道
4. `localWebServer.start()` -- 启动 InAppLocalhostServer（端口 8080，提供 assets/web 静态资源）
5. `AdaptiveTheme.getThemeMode()` -- 读取已保存的主题模式
6. `_configureDesktopWindow(savedThemeMode)` -- 桌面端配置窗口（大小/位置/主题色/关闭确认）
7. `runApp(...)` -- 启动应用

Widget 树结构：

```
EasyLocalization (zh/en)
  +-- ProviderScope (Riverpod)
       +-- AgentSpacesApp (ConsumerWidget)
            +-- AdaptiveTheme (明/暗/系统)
                 +-- MaterialApp.router
                      +-- UpgradeAlert (版本升级)
                           +-- GoRouter (路由)
```

## 路由配置

GoRouter 定义了 7 条路由：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | `HomeScreen` | 主屏幕（WebView 浏览器 + 服务器发现） |
| `/bookmarks` | `BookmarksScreen` | 书签管理 |
| `/settings` | `SettingsScreen` | 设置页 |
| `/settings/terminal-credentials` | `TerminalCredentialsScreen` | SSH 凭据管理 |
| `/settings/file-source-credentials` | `FileSourceCredentialsScreen` | 文件源凭据管理 |
| `/about` | `AboutScreen` | 关于 |

## 桌面窗口管理

桌面端（Linux/macOS/Windows）通过 `window_manager` 管理：

- 默认窗口大小：1280x820
- 最小窗口大小：960x640
- 启动时居中显示
- 窗口状态（位置/大小/最大化/全屏）自动持久化到 SharedPreferences
- 窗口关闭时先保存状态再销毁（防抖 300ms）
- `_WindowThemeSync` 监听主题变化，自动同步窗口背景色和亮度

## 版本升级检测

通过 `Upgrader` 实现：

- 支持 Appcast URL（通过编译参数 `APPCAST_URL` 传入）
- 覆盖 Android/iOS/macOS/Windows 四个平台
- 使用 `UpgradeAlert` 包裹整个应用，自动弹出升级提示

## 本地 Web 服务器

`InAppLocalhostServer` 在端口 8080 提供本地 Web 资源（从 `assets/web/` 目录）：

- 首页 `HomePage` 会检测 `http://localhost:8080/index.html` 是否可用
- 可用时提供"打开本地"选项，直接在 WebView 中加载本地打包的 Web 前端
