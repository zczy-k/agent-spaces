[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/module-responsibilities.md**

# 子模块职责

## models/ (数据模型)

| 文件 | 职责 |
|------|------|
| `browser_tab.dart` | `BrowserTab`（id/title/url/faviconUrl/device/type/fileSourceConfig/terminalCredential/createdAt）+ `DeviceProfile`（phone/tablet/desktop 三种尺寸 + User-Agent）+ `DeviceType` 枚举 + `BrowserTabType` 枚举（webview/terminal/fileSource）+ `SplitLayout` 枚举（single/horizontal2/vertical2/horizontal3/quad） |
| `bookmark.dart` | `Bookmark`（id/name/url/deviceType/createdAt，JSON 序列化）+ `AppSettings`（restoreTabsOnStartup/restoreLayoutOnStartup/webViewDebuggingEnabled/incognito） |
| `terminal_credential.dart` | `TerminalCredential`（id/name/host/port/username/password/privateKey/passphrase/createdAt），支持密码和私钥两种认证方式 |
| `file_source_config.dart` | `FileSourceConfig`（type/label/rootPath/host/port/username/password/baseUrl）+ `FileSourceType` 枚举（sftp/ftp/storage/webdav） |
| `file_source_credential.dart` | `FileSourceCredential`（id/name/type/host/port/username/password/baseUrl/rootPath/createdAt），带 `summary` 属性和 `toConfig()` 转换方法 |

## providers/ (状态管理)

| Provider | 状态类型 | 职责 |
|----------|----------|------|
| `browserProvider` | `BrowserState` | Tab 列表管理：addTab/addTerminalTab/addFileSourceTab/closeTab/setActiveTab/updateTab/setDevice/setHomeUrl/setSplitLayout/saveDockingLayout，启动时可选恢复 Tabs 和布局 |
| `bookmarkProvider` | `List<Bookmark>` | 书签 CRUD：addBookmark/removeBookmark/updateBookmark/isBookmarked/findByUrl |
| `settingsProvider` | `AppSettings` | 应用设置：restoreTabsOnStartup/restoreLayoutOnStartup/webViewDebuggingEnabled/incognito 开关 |
| `consoleLogProvider` | `ConsoleLogState` | WebView 控制台日志捕获：setCapturing/addLog/clearLogs |
| `terminalCredentialsProvider` | `List<TerminalCredential>` | SSH 凭据 CRUD：add/update/remove |
| `fileSourceCredentialsProvider` | `List<FileSourceCredential>` | 文件源凭据 CRUD：add/update/remove/byType |

## services/ (服务层)

| 文件 | 职责 |
|------|------|
| `storage_service.dart` | SharedPreferences 单例封装，持久化：bookmarks/app_settings/saved_tabs/saved_active_tab/saved_split_layout/saved_docking_layout/home_url/permission_dialog_seen/terminal_credentials/file_source_credentials |
| `notification_service.dart` | awesome_notifications 封装：初始化通知通道/请求权限/发送通知 |
| `webview_service.dart` | InAppWebViewController 注册表（Map<tabId, Controller>），提供 zoom/loadUrl/evaluateJS/getTitle/reload/goBack/goForward/clearAllCache/setDebuggingEnabled |
| `file_sources/file_source.dart` | `FileSource` 抽象类 + `FileSourceEntry` 数据类 |
| `file_sources/file_source_factory.dart` | `createFileSource(config)` 工厂函数 |
| `file_sources/path_utils.dart` | 路径工具函数：joinRemotePath/joinLocalPath/localBasename/basenameOf/dirnameOf/ensureTrailingSlash |
| `file_sources/sftp_file_source.dart` | SFTP 文件源实现（基于 dartssh2） |
| `file_sources/ftp_file_source.dart` | FTP 文件源实现（基于 ftpconnect），不支持 copy |
| `file_sources/storage_file_source.dart` | 本地存储文件源实现（基于 dart:io） |
| `file_sources/webdav_file_source.dart` | WebDAV 文件源实现（基于 webdav_client），带自定义错误解析 |
| `file_sources/webdav_url.dart` | WebDAV URL 规范化工具 |

## screens/ (页面)

| 页面 | 路由 | 职责 |
|------|------|------|
| `HomeScreen` | `/` | 主屏幕。初始化 Settings 和 Browser Provider，展示 WebViewPanel |
| `BookmarksScreen` | `/bookmarks` | 书签管理。列表展示，点击打开新 Tab，长按弹出编辑/删除 |
| `SettingsScreen` | `/settings` | 设置页。启动恢复/WebView调试/无痕模式/通知权限/语言/主题/缓存清理/终端凭据/文件源凭据/关于入口 |
| `TerminalCredentialsScreen` | `/settings/terminal-credentials` | SSH 凭据管理页。列表展示，支持密码和私钥两种方式 |
| `FileSourceCredentialsScreen` | `/settings/file-source-credentials` | 文件源凭据管理页。Tab 分页（SFTP/FTP/WebDAV） |
| `AboutScreen` | `/about` | 关于页。版本信息、技术栈、项目链接 |

## widgets/ (组件)

| 组件 | 职责 |
|------|------|
| `WebViewPanel` | 核心容器面板。无 Tab 时显示 HomePage（服务器发现），有 Tab 时渲染 SplitLayoutView |
| `WebViewInstance` | 单个 WebView 实例。按 DeviceProfile 约束尺寸，注入 JS Bridge + 键盘视口脚本，监听标题/favicon/错误/控制台日志 |
| `TerminalInstance` | SSH 终端实例。dartssh2 连接 + xterm 渲染，带命令历史、虚拟键盘 |
| `TerminalLoginForm` | SSH 登录表单。支持密码/私钥认证，可从已保存凭据选择 |
| `TerminalToolbar` | 终端工具栏。方向键/历史/虚拟键盘/Ctrl+C/清屏/复制/粘贴 |
| `TerminalVirtualKeyboard` | 终端虚拟键盘。支持 Ctrl/Alt/Shift 修饰键，发送转义序列 |
| `FileSourceTree` | 文件源文件树。统一文件树界面，支持多选、上传（含拖拽）、下载、重命名/复制/移动/删除，带上传/下载进度条 |
| `SplitLayoutView` | Docking 分屏布局。基于 docking 库实现可拖拽 Tab 布局，支持 5 种分屏模式，持久化/恢复布局状态 |
| `HomePage` | 服务器发现首页。检测本地 Web 资源 + 手动输入地址 |
| `HomeCards` | 首页卡片组件（ActionCard/ServerCard） |
| `DeviceSelector` | 设备类型选择器 |
| `TabContextMenu` | Tab 右键/长按菜单（导航/设备/书签/外部打开/刷新/调试/控制台/分屏） |
| `TabDialogs` | Tab 对话框（新建 Tab/导航/设备选择/调试信息） |
| `TabWidgets` | Tab 菜单构建（浏览器菜单项/文件源对话框/FaviconIcon/分屏菜单/NavButton） |
| `ConsoleSheet` | WebView 控制台日志底部面板 |
| `DebugWidgets` | 调试信息展示组件（DebugInfoRow/DebugStepsSection） |

## bridge/ (通信层)

| 文件 | 职责 |
|------|------|
| `js_bridge.dart` | Flutter <-> WebView 双向通信桥。注入 `__flutterBridge` JS 对象，支持 `on/emit` 事件模式 + `invoke` RPC 模式（Promise 回调）。设置 `window.isFlutterEnvironment()` 和 `window.isTauriEnvironment()` 环境检测 |
