[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/data-model.md**

# 数据模型

## 持久化架构

所有数据通过 `StorageService` 使用 SharedPreferences 持久化，以 JSON 字符串形式存储。

| 存储 Key | 数据类型 | 说明 |
|----------|----------|------|
| `bookmarks` | `List<Bookmark>` JSON | 书签列表 |
| `app_settings` | `AppSettings` JSON | 应用设置 |
| `saved_tabs` | `List<BrowserTab>` JSON（自定义序列化） | 已打开的 Tab 列表 |
| `saved_active_tab` | String | 当前活跃 Tab ID |
| `saved_split_layout` | String (SplitLayout.name) | 分屏布局模式 |
| `saved_docking_layout` | String (docking 序列化) | Docking 布局状态 |
| `home_url` | String | 主页 URL |
| `permission_dialog_seen` | bool | 是否已显示通知权限弹窗 |
| `terminal_credentials` | `List<TerminalCredential>` JSON | SSH 凭据列表 |
| `file_source_credentials` | `List<FileSourceCredential>` JSON | 文件源凭据列表 |
| `window.bounds.*` / `window.maximized` / `window.fullscreen` | double/bool | 桌面窗口状态 |

## 核心类型

### BrowserTab

```
BrowserTab {
  id: String                    // UUID
  title: String                 // 标签标题
  url: String                   // 当前 URL
  faviconUrl: String?           // Favicon URL
  device: DeviceProfile         // 设备模拟配置
  type: BrowserTabType          // Tab 类型
  fileSourceConfig: FileSourceConfig?   // 文件源配置（仅 fileSource 类型）
  terminalCredential: TerminalCredential?  // SSH 凭据（仅 terminal 类型）
  createdAt: DateTime           // 创建时间
}
```

### BrowserTabType 枚举

| 值 | 索引 | 说明 |
|---|------|------|
| `webview` | 0 | WebView 浏览器 Tab |
| `terminal` | 1 | SSH 终端 Tab |
| `fileSource` | 2 | 文件源 Tab |

### DeviceProfile

| 预设 | 类型 | 尺寸 | User-Agent |
|------|------|------|------------|
| `phone` | DeviceType.phone | 375x812 | iPhone Safari 17 |
| `tablet` | DeviceType.tablet | 768x1024 | iPad Safari 17 |
| `desktop` | DeviceType.desktop | 1280x800 | (空，使用默认) |

### SplitLayout 枚举

| 值 | 分屏数 | 说明 |
|---|--------|------|
| `single` | 1 | 单屏 |
| `horizontal2` | 2 | 水平 2 分屏 |
| `vertical2` | 2 | 垂直 2 分屏 |
| `horizontal3` | 3 | 水平 3 分屏 |
| `quad` | 4 | 四分屏 |

### AppSettings

```
AppSettings {
  restoreTabsOnStartup: bool      // 启动时恢复 Tabs（默认 true）
  restoreLayoutOnStartup: bool    // 启动时恢复布局（默认 true）
  webViewDebuggingEnabled: bool   // WebView 调试（默认 kDebugMode）
  incognito: bool                 // 无痕模式（默认 false）
}
```

### Bookmark

```
Bookmark {
  id: String
  name: String
  url: String
  deviceType: DeviceType
  createdAt: DateTime
}
```

### TerminalCredential

```
TerminalCredential {
  id: String
  name: String
  host: String
  port: int
  username: String
  password: String?         // 密码认证
  privateKey: String?       // 私钥认证（PEM 格式）
  passphrase: String?       // 私钥口令
  createdAt: DateTime
}
```

### FileSourceConfig / FileSourceCredential

```
FileSourceConfig {
  type: FileSourceType      // sftp / ftp / storage / webdav
  label: String
  rootPath: String          // 默认 '/'
  host: String
  port: int
  username: String
  password: String
  baseUrl: String           // WebDAV 专用
}
```

### BrowserState

```
BrowserState {
  tabs: List<BrowserTab>
  activeTabId: String
  homeUrl: String               // 默认 'http://localhost:3000'
  splitLayout: SplitLayout      // 默认 single
  savedDockingLayout: String?   // docking 库序列化布局
}
```

### ConsoleLogState

```
ConsoleLogState {
  logs: List<ConsoleLog>
  capturing: bool     // 是否在捕获日志（默认 false）
}
```

## 状态枚举

| 枚举 | 值 | 说明 |
|------|---|------|
| `DeviceType` | phone / tablet / desktop | 设备类型 |
| `BrowserTabType` | webview / terminal / fileSource | Tab 类型 |
| `SplitLayout` | single / horizontal2 / vertical2 / horizontal3 / quad | 分屏布局 |
| `FileSourceType` | sftp / ftp / storage / webdav | 文件源协议类型 |
