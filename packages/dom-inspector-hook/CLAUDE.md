[根目录](../../CLAUDE.md) > [packages](../) > **dom-inspector-hook**

# dom-inspector-hook

## 模块职责

独立发布的浏览器端运行时 Hook，配合 [`code-inspector-plugin`](https://github.com/zh-lx/code-inspector-plugin) 使用。在打包产物里关闭默认 IDE 跳转，转而捕获页面元素的源码位置信息（path / name / line / column），并按配置走三种动作之一：

- `http` —— 静默 POST 到自定义 URL（典型用法：上报到 Agent Spaces server 的 `/api/inspector/track`）
- `editor` —— 打开 `http://localhost:5678` IDE 跳转
- `auto` —— 弹出选择对话框，由用户选 Send HTTP / Open Editor / Cancel

可选地将 `path:line:column` 复制到剪贴板。框架无关，React / Vue / Solid 等任意前端均可使用。

## 入口与启动

- **入口文件**：`src/index.ts`
- **构建**：`tsup`（输出 `dist/index.js` ESM + `dist/index.cjs` CJS + `dist/index.d.ts` 类型），`pnpm build` / `pnpm dev`
- **消费方式**：作为 `peerDependencies` 依赖 `code-inspector-plugin >= 0.7.0`；在目标项目的打包工具配置中通过 `codeInspectorPlugin({ behavior: createBehavior() })` 关闭默认行为，再在应用入口调用 `bindCaptureListener({ url, mode, copy })`

## 对外接口

仅 3 个公开导出（见 `src/index.ts`）：

| 导出 | 类型 | 说明 |
|------|------|------|
| `createBehavior(options?)` | `(opts?: { copy?: boolean }) => { locate: false; copy: false }` | 返回 `code-inspector-plugin` 的 `behavior` 配置，关闭默认 IDE 跳转；`options.copy` 仅为占位，实际复制由 `bindCaptureListener` 控制 |
| `bindCaptureListener(options)` | `(opts: InspectorHookOptions) => () => void` | 绑定 `window` 上的 `code-inspector:trackCode` 事件；返回取消监听函数 |
| `InspectorHookOptions`（类型） | interface | `{ url?: string; headers?: Record<string,string>; mode?: 'auto'\|'http'\|'editor'; copy?: boolean }` |
| `CapturedSourceInfo`（类型） | interface | `{ path: string; name: string; line: number; column: number; timestamp: number }` |
| `ActionMode`（类型） | union | `'auto' \| 'http' \| 'editor'` |

### POST 数据契约（mode 为 http / auto-选 http 时）

```json
{
  "path": "/src/components/Button.tsx",
  "name": "Button",
  "line": 10,
  "column": 5,
  "timestamp": 1715961234567
}
```

POST 到 `options.url`，Content-Type `application/json`，可叠加 `options.headers`。

## 关键依赖与配置

- **运行时依赖**：仅浏览器原生 `fetch` 与 `navigator.clipboard`；零运行时 npm 依赖
- **Peer 依赖**：`code-inspector-plugin >= 0.7.0`（在宿主项目中安装）
- **Dev 依赖**：`tsup ^8.4.0`、`typescript ^5.7.0`、`code-inspector-plugin ^1.5.1`
- **tsconfig.json**：标准 DOM lib
- **tsup.config.ts**：双格式（ESM + CJS）+ dts
- **License**：MIT

## 数据模型

无持久化。仅两个内部 interface（见 `src/types.ts`）：`InspectorHookOptions`（配置）、`CapturedSourceInfo`（事件载荷）。`src/types.ts` 同时承载运行时辅助函数 `postCapture(url, data, headers)` 与 `copyToClipboard(text)`。

## 测试与质量

- 未发现单元测试目录或测试框架配置
- 验证方式：在 `examples/react-app` 或 `examples/vue-app` 中接入，按住 `Alt+Shift`（Mac: `Option+Shift`）点击元素，观察是否弹出对话框 / 收到 POST

## 常见问题 (FAQ)

- **Q: 为什么必须配合 `createBehavior()`？** A: `code-inspector-plugin` 默认会自动打开 IDE；本 Hook 的目标是把动作交还应用层（HTTP 上报或可定制跳转），因此需要先用 `behavior: createBehavior()` 关掉默认行为。
- **Q: IDE 跳转地址能改吗？** A: 不能从 `bindCaptureListener` 入参改；当前硬编码 `http://localhost:5678`，如需自定义需改 `src/index.ts` 的 `handleAction`。
- **Q: 弹窗样式能定制吗？** A: 不能通过 API 配置；`auto` 模式的对话框是 `src/index.ts` 内 `showActionDialog` 直接创建的内联 DOM。

## 相关文件清单

| 文件 | 说明 |
|------|------|
| `src/index.ts` | 入口：`createBehavior` + `bindCaptureListener` + 弹窗 + 动作分发（157 行） |
| `src/types.ts` | 类型定义 + `postCapture` / `copyToClipboard` 运行时辅助 |
| `package.json` | 包元数据，name `dom-inspector-hook`，version `0.2.1`，tsup 构建 |
| `tsup.config.ts` | 双格式构建配置 |
| `tsconfig.json` | TS 编译选项 |
| `README.md` | 完整使用文档（Vite/Webpack/Rspack/Next.js/Nuxt/Vue CLI/Umi/Astro/Rsbuild/esbuild/Farm 12 种打包工具接入示例） |
| `examples/react-app/` | React 接入示例（package.json） |
| `examples/vue-app/` | Vue 接入示例（package.json） |

## 变更记录 (Changelog)

- **2026-06-12**：首次生成 CLAUDE.md。确认源文件 2 个（`src/index.ts` + `src/types.ts`），版本 0.2.1，对外接口 3 个导出 + 3 个类型。
