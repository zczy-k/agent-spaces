# 研究发现

## 当前 Tauri2 架构分析

### 目录结构
```
packages/tauri/
  package.json          # @agent-spaces/tauri, tauri CLI scripts
  src-tauri/
    Cargo.toml          # tauri 2.11.1 + 5 个插件
    tauri.conf.json     # 应用配置（800x600, CSP, 多平台 bundle）
    src/lib.rs          # 仅插件初始化，无自定义 command
    icons/              # 全平台图标
```

### Tauri 使用的前端接口

1. **全屏** (`tauri-fullscreen.tsx`)
   - `getCurrentWindow().setFullscreen(true)` - 启动时自动全屏

2. **缩放** (`zoom-wrapper.tsx`)
   - `webview.getCurrentWebview().setZoom(value/100)` - 50%-200% 范围
   - localStorage 持久化 + CustomEvent 通信

3. **原生通知** (`native-notification.ts`)
   - `isTauriEnvironment()` - 检测 `tauri.localhost` 或 `__TAURI_INTERNALS__`
   - `isTauriAndroidEnvironment()` - 检测 Android UA
   - `isPermissionGranted()` / `requestPermission()` / `sendNotification()`
   - Android ongoing task notification (id=10001)

4. **Android 返回键** (`workspace-shell.tsx:159`)
   - `onBackButtonPress` from `@tauri-apps/api/app`

5. **Viewport 适配** (`viewport-insets.tsx`)
   - `window.__agentSpacesNativeInsets` native bridge
   - CSS custom properties for layout

6. **环境检测** 模式
   ```typescript
   typeof window !== "undefined"
     && (window.location.hostname === "tauri.localhost"
         || "__TAURI_INTERNALS__" in window)
   ```

### 前端对 Tauri 的依赖点（需适配）

| 文件 | 依赖内容 | Flutter 适配方案 |
|------|---------|-----------------|
| `native-notification.ts` | isTauriEnvironment(), Tauri notification plugin | 添加 isFlutterEnvironment() 检测 |
| `zoom-wrapper.tsx` | __TAURI__.webview.setZoom() | JS channel 调用 Flutter zoom API |
| `tauri-fullscreen.tsx` | getCurrentWindow().setFullscreen() | JS channel 调用 Flutter fullscreen |
| `workspace-shell.tsx` | onBackButtonPress | Flutter WillPopScope 处理 |
| `viewport-insets.tsx` | __agentSpacesNativeInsets | Flutter MediaQuery 注入 |
| `layout.tsx` | 引入 ZoomWrapper, ViewportInsets | 保持组件，内部适配 Flutter |
| `next.config.ts` | NEXT_STATIC_EXPORT 静态导出 | Flutter 加载静态 build 或远程 URL |
| `lib/navigate.ts` | Tauri 静态路由适配 | Flutter WebView 内路由无需特殊处理 |

### 构建管线

- GitHub Actions `release.yml`: tag 触发多平台构建
- 静态导出：`NEXT_STATIC_EXPORT=1 pnpm build` -> `packages/tauri/web/`
- Tauri 打包：复制 web dist + tauri build

## flutter_inappwebview 关键 API

- `InAppWebView` widget - 核心 WebView
- `InAppWebViewController` - 控制器
- `InAppWebViewSettings` - 配置（ userAgent, supportZoom, etc.）
- `JavaScriptBridge` - JS Bridge（addJavaScriptHandler / evaluateJavascript）
- `loadUrl()` / `loadFile()` - 加载方式
- `InAppWebViewSettings.userAgent` - 自定义 UA
- WebView 池：每个 Tab 一个 InAppWebView 实例，通过 Visibility 控制渲染

## awesome_notifications 关键 API

- `AwesomeNotifications().initialize()` - 初始化
- `AwesomeNotifications().requestPermissionToSendNotifications()` - 权限
- `AwesomeNotifications().createNotification()` - 创建通知
- `AwesomeNotifications().setListeners()` - 前台/后台通知监听
- 支持自定义通知布局（Android）
- 支持通知渠道/分组
- 支持 Action Buttons（通知按钮回调）

## Device 模拟实现方案

| Device | Viewport | User-Agent 后缀 |
|--------|----------|-----------------|
| Phone | 375x812 | Mobile (iPhone/Android) |
| Tablet | 768x1024 | Tablet (iPad) |
| Desktop | 1280x800 | 无后缀（默认桌面 UA）|

实现方式：切换 Device 时
1. 更新 `InAppWebViewSettings.userAgent`
2. 通过 JS 注入设置 viewport meta
3. 触发 `window.dispatchEvent(new Event('resize'))`
4. 可选：使用 flutter_inappwebview 的 `customScale` 调整缩放
