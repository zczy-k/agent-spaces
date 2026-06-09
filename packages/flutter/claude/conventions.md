[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/conventions.md**

# 编码约定

## 语言与框架

- Dart SDK ^3.10.1，启用 `flutter_lints` 规则集
- 所有 Widget 使用 `ConsumerWidget`（无状态）或 `ConsumerStatefulWidget`（有状态）
- 使用 Riverpod `StateNotifierProvider` 模式进行状态管理

## 状态管理规则

- 所有 Provider 定义在 `providers/` 目录下
- 状态类为 immutable（使用 `const` 构造函数 + `copyWith` 方法）
- 状态变更后自动调用 `StorageService` 持久化
- 通过 `ref.watch()` 在 Widget 中订阅，`ref.read().notifier` 触发变更
- Provider 初始化时从 StorageService 加载已保存数据

## 命名规范

- 文件名使用 `snake_case`（如 `browser_provider.dart`）
- 类名使用 `PascalCase`（如 `BrowserTab`、`HomeScreen`）
- Provider 命名：`xxxProvider`（如 `browserProvider`、`bookmarkProvider`）
- StateNotifier 命名：`XxxNotifier`（如 `BrowserNotifier`）
- State 类命名：`XxxState`（如 `BrowserState`、`ConsoleLogState`）

## UI 风格

- Material 3 设计系统，主色 `Color(0xFF2563EB)`（蓝色）
- 使用 `adaptive_theme` 支持明/暗/跟随系统三种主题
- 紧凑布局：`dense: true`，图标 size 16-20
- 文本字号：11（副标题）/ 12（正文辅助）/ 13（正文）/ 14-16（标题）
- 使用 `easy_localization` 做国际化，翻译键使用 `snake_case` 带命名空间前缀

## 数据模型

- 使用 `copyWith` 模式实现不可变更新
- JSON 序列化通过手写 `toJson()` / `fromJson()` / `fromSaved()` 方法
- 持久化通过 `StorageService` 静态方法统一管理，底层为 SharedPreferences

## 目录组织

```
lib/
  models/          数据模型（纯 Dart 类，不含 UI）
  providers/       状态管理（StateNotifier + State）
  services/        服务层（存储、通知、WebView、文件源）
    file_sources/  文件源抽象和实现
  screens/         页面（Scaffold 级别）
  widgets/         可复用组件（按钮、面板、表单等）
  bridge/          Flutter <-> WebView 通信桥
```

## Tab 类型系统

`BrowserTabType` 枚举定义三种 Tab 类型：

- `webview` -- WebView 浏览器 Tab，渲染 InAppWebView
- `terminal` -- SSH 终端 Tab，渲染 TerminalInstance（xterm + dartssh2）
- `fileSource` -- 文件源 Tab，渲染 FileSourceTree（animated_tree_view）

每种 Tab 类型对应不同的渲染逻辑（在 `split_layout.dart` 的 `_buildTabPane` 中分发）。

## 文件源抽象

所有文件源（SFTP/FTP/Storage/WebDAV）遵循 `FileSource` 抽象类接口：

- `connect()` / `disconnect()` -- 连接管理
- `list(path)` -- 列出目录内容，返回 `List<FileSourceEntry>`
- `createFile` / `createFolder` -- 创建
- `rename` / `copy` / `move` -- 重命名/复制/移动
- `upload` / `download` -- 上传/下载
- `delete` -- 删除
- `stat` -- 获取文件信息

通过 `createFileSource(config)` 工厂函数按类型创建实现。
