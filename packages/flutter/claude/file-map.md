[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/file-map.md**

# 文件地图

## 源码结构

```
packages/flutter/
  lib/
    main.dart                                      # 应用入口 + GoRouter 路由 + MaterialApp 配置
    bridge/
      js_bridge.dart                               # Flutter <-> WebView JS Bridge 双向通信
    models/
      browser_tab.dart                             # BrowserTab + DeviceProfile + DeviceType + BrowserTabType
      bookmark.dart                                # Bookmark + AppSettings
      terminal_credential.dart                     # TerminalCredential（SSH 凭据）
      file_source_config.dart                      # FileSourceConfig + FileSourceType
      file_source_credential.dart                  # FileSourceCredential
    providers/
      browser_provider.dart                        # BrowserState + BrowserNotifier（核心 Tab 管理）
      bookmark_provider.dart                       # BookmarkNotifier（书签 CRUD）
      settings_provider.dart                       # SettingsNotifier（应用设置）
      console_log_provider.dart                    # ConsoleLogNotifier + ConsoleLog（控制台日志）
      terminal_credentials_provider.dart           # TerminalCredentialsNotifier（SSH 凭据 CRUD）
      file_source_credentials_provider.dart        # FileSourceCredentialsNotifier（文件源凭据 CRUD）
    screens/
      home_screen.dart                             # 主屏幕
      bookmarks_screen.dart                        # 书签管理页
      settings_screen.dart                         # 设置页
      terminal_credentials_screen.dart             # SSH 凭据管理页
      file_source_credentials_screen.dart          # 文件源凭据管理页
      about_screen.dart                            # 关于页
    services/
      storage_service.dart                         # SharedPreferences 持久化
      notification_service.dart                    # 原生通知
      webview_service.dart                         # WebView Controller 管理
      file_sources/
        file_source.dart                           # FileSource 抽象类 + FileSourceEntry
        file_source_factory.dart                   # createFileSource 工厂函数
        path_utils.dart                            # 路径工具函数
        webdav_url.dart                            # WebDAV URL 规范化
        sftp_file_source.dart                      # SFTP 实现
        ftp_file_source.dart                       # FTP 实现
        storage_file_source.dart                   # 本地存储实现
        webdav_file_source.dart                    # WebDAV 实现
    widgets/
      webview_panel.dart                           # WebView 容器面板 + 服务器发现徽章
      webview_instance.dart                        # 单个 WebView 实例
      home_page.dart                               # 服务器发现首页
      home_cards.dart                              # ActionCard + ServerCard 组件
      device_selector.dart                         # 设备类型选择器
      split_layout.dart                            # Docking 分屏布局（SplitLayoutView）
      file_source_tree.dart                        # 文件源文件树（FileSourceTree）
      terminal_instance.dart                       # SSH 终端实例（TerminalInstance）
      terminal_login_form.dart                     # SSH 登录表单
      terminal_toolbar.dart                        # 终端工具栏
      terminal_virtual_keyboard.dart               # 终端虚拟键盘
      tab_context_menu.dart                        # Tab 右键/长按菜单
      tab_dialogs.dart                             # Tab 对话框
      tab_widgets.dart                             # Tab 菜单构建 + 文件源对话框 + FaviconIcon
      console_sheet.dart                           # 控制台日志底部面板
      debug_widgets.dart                           # 调试信息组件
  test/
    widget_test.dart                               # 冒烟测试
    services/
      file_sources/
        webdav_url_test.dart                       # normalizeWebDavBaseUrl 单元测试
  pubspec.yaml                                     # 依赖与构建配置
  analysis_options.yaml                            # Lint 规则
  docs/
    file-source-tabs.md                            # 文件源 Tab 功能说明
```

## 统计

| 类别 | 数量 |
|------|------|
| Dart 源文件（lib/） | 44 |
| 测试文件（test/） | 2 |
| 配置文件 | 2（pubspec.yaml, analysis_options.yaml） |
| 文档文件 | 1（docs/file-source-tabs.md） |
| 总 Dart 文件 | 46 |
