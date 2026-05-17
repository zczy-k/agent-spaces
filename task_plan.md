# 任务计划：Flutter 客户端替代 Tauri2

## 目标

在 `packages/flutter` 创建 Flutter 客户端（Android、iOS、macOS、Windows），替代当前 `packages/tauri` 的 Tauri2 实现。保留 Tauri2 所有功能，并增加多 Tab Webview 浏览器和前后台通知。

## 新增功能需求

1. **多 Tab Webview 浏览器**：支持创建多个 Webview Tab，Tab 之间可切换；支持给当前 Webview 设置 device 模拟（平板、手机、桌面）
2. **前后台通知**：前台通知（应用内）+ 后台通知（系统级，awesome_notifications）
3. **使用 flutter_inappwebview** 加载 Next.js 前端
4. **使用 awesome_notifications** 处理通知

## 当前 Tauri2 功能清单（需平移）

| 功能 | Tauri 实现 | Flutter 对应 |
|------|-----------|-------------|
| 全屏模式 | `getCurrentWindow().setFullscreen(true)` | `SystemChrome.setEnabledSystemUIMode` |
| 缩放控制 | `webview.setZoom(scale)` | flutter_inappwebview zoom |
| 原生通知 | @tauri-apps/plugin-notification | awesome_notifications |
| Android 返回键 | `onBackButtonPress` | WillPopScope / PopScope |
| Viewport 适配 | viewport-insets.tsx | MediaQuery + SafeArea |
| 加载静态前端 | frontendDist: ../../web/out | flutter_inappwebview loadFile/loadUrl |
| 环境检测 | `isTauriEnvironment()` | JS channel 注入标志 |
| 日志 | tauri-plugin-log | dart:developer + logger |
| 文件系统 | tauri-plugin-fs | path_provider + dart:io |
| 对话框 | tauri-plugin-dialog | flutter dialog |
| 分享 | tauri-plugin-share | share_plus |

## 阶段

### 阶段 1：项目脚手架 `complete`
- 创建 `packages/flutter` Flutter 项目
- 配置 pubspec.yaml（flutter_inappwebview, awesome_notifications, logger, path_provider, share_plus, provider/riverpod）
- 配置多平台支持（android, ios, macos, windows）
- 配置应用名称、包名、图标
- **验证**：`flutter create` 成功，各平台目录存在

### 阶段 2：核心 WebView 引擎 `complete`
- 实现 WebView 引擎封装（flutter_inappwebview）
- 加载 Next.js 前端（支持本地文件 + 远程 URL）
- 实现 JS Bridge（替代 Tauri invoke 机制）
  - 注入 `window.__FLUTTER_INTERNALS__` 标志
  - 暴露 JS channel：zoom、fullscreen、notification、device 等
- 实现缩放控制（zoom 属性映射）
- 实现全屏模式切换
- **验证**：加载前端页面正常显示，JS Bridge 双向通信正常

### 阶段 3：多 Tab Webview 浏览器 `complete`
- 实现 Tab 数据模型（id, title, url, deviceId, webviewController）
- 实现 Tab 管理器（增删改查、激活切换）
- 实现 Tab 栏 UI（横向滚动标签、添加/关闭按钮、拖拽排序）
- 实现 Webview 池管理（可见 Tab 渲染，隐藏 Tab 保留状态）
- **验证**：可创建/切换/关闭多个 Tab，每个 Tab 独立加载

### 阶段 4：Device 模拟 `complete`
- 实现 Device 模型（phone、tablet、desktop，含 viewport 尺寸 + UA 字符串）
- 实现 Device 切换 UI（下拉选择或工具栏按钮）
- 切换 Device 时动态调整 Webview viewport 和 User-Agent
- **验证**：切换 Device 后页面响应式布局变化

### 阶段 5：通知系统 `complete`
- 配置 awesome_notifications（Android/iOS 权限、图标、渠道）
- 实现前台通知（应用内弹出通知卡片）
- 实现后台通知（系统通知栏）
- 对接 JS Bridge：前端调用 `sendNativeNotification()` -> Flutter 原生通知
- 实现通知点击回调（打开对应 Tab 或页面）
- **验证**：前后台通知都能正常发送和接收

### 阶段 6：平台适配 `pending`（待各平台实际测试）
- Android：返回键处理、状态栏/导航栏适配、键盘适配
- iOS：Safe Area 适配、通知权限
- macOS：窗口管理、菜单栏
- Windows：窗口管理、任务栏
- **验证**：各平台构建运行正常

### 阶段 7：前端适配 `complete`
- 修改 `packages/web` 的环境检测逻辑，识别 Flutter 环境
- 添加 `isFlutterEnvironment()` 函数（检查 `window.__FLUTTER_INTERNALS__`）
- 更新 native-notification.ts 支持 Flutter 通知通道
- 更新 zoom-wrapper.tsx 支持 Flutter zoom 通道
- **验证**：前端在 Flutter WebView 中功能正常

### 阶段 8：构建与集成 `pending`（待 CI/CD 配置和图标资源）
- 编写构建脚本（对标 tauri package.json scripts）
- CI/CD 配置（GitHub Actions 多平台构建）
- 应用图标和启动屏
- 清理 packages/tauri 旧代码（可选，用户确认后）
- **验证**：各平台打包输出正常

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| (暂无) | - | - |

## 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态管理 | Riverpod | 类型安全、编译期检查、适合多 Tab 复杂状态 |
| WebView | flutter_inappwebview | 功能最全，支持多实例、JS Bridge、自定义 UA |
| 通知 | awesome_notifications | 支持前后台、全平台、自定义布局 |
| 路由 | go_router | 声明式路由，支持深链接 |
| 本地存储 | shared_preferences + hive | 轻量配置 + 结构化数据 |
