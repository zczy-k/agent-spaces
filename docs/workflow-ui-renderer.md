# Workflow UI 渲染器与多文件支持

本文档说明 Workflow UI 渲染器的工作原理、多文件项目支持、模块解析机制和推荐文件布局。

## 渲染器架构

Workflow UI 渲染器 (`workflow-ui-renderer.tsx`) 在浏览器端编译和运行用户编写的 React/HTML 代码，无需服务端构建。

### React 模式运行流程

```
用户源码 (JSX)
  → Babel standalone 编译 (presets: react, plugins: transform-modules-commonjs)
  → CommonJS 代码
  → new Function('React', 'ReactDOM', 'exports', 'require', compiled)
  → moduleExports.default 作为组件
  → ReactDOM.createRoot().render()
```

### 关键设计

- **无构建步骤**：使用 `@babel/standalone` 在浏览器端实时编译，支持 JSX 和 ES module 语法。
- **全局 UI 组件**：宿主应用通过 `window.AgentSpacesUI` 注入 shadcn/ui 组件（Button、Card、Slider 等），用户代码通过解构使用，无需 import。
- **插件工具调用**：`window.AgentSpaces.callPluginTool(pluginId, toolName, args)` 直接返回插件 tool 结果。
- **配置持久化**：`window.AgentSpacesUI.readConfigJson` / `writeConfigJson` 读写 `configs/` 目录下的 JSON 文件。
- **数据文件**：`window.AgentSpacesUI.saveDataFile` / `downloadFile` 操作 `data/` 目录。

## 多文件项目支持

渲染器支持 ES module 语法在本地文件之间导入，允许将大型项目拆分为多个文件。

### 模块解析机制

1. **入口文件**：由 `manifest.json` 的 `mainFile` 字段决定（默认 `index.jsx`），必须 `export default` 一个 React 组件。
2. **import 转换**：Babel `transform-modules-commonjs` 将 `import Foo from './components/Foo'` 转为 `require('./components/Foo')`。
3. **外部模块映射**：渲染器先处理宿主允许的外部模块：
   - `react`
   - `react-dom` / `react-dom/client`
   - `embla-carousel-react`
   - `@agent-spaces/ui`（宿主 UI 导出）
4. **本地文件解析**：外部模块未命中时，渲染器解析本地相对路径：
   - 相对路径归一化（处理 `./` 和 `../`）
   - 扩展名自动补全：`.jsx` → `.js` → `.tsx` → `.ts`
   - 目录索引：`./utils` → `./utils/index.jsx` → `./utils/index.js`
5. **模块缓存**：每个文件只编译一次，循环依赖时返回部分填充的 exports（与 Node.js CommonJS 行为一致）。

### 外部依赖兼容规则

Workflow UI 项目里的源码运行在 renderer 的 `new Function()` 沙箱中，不经过 Next.js/Vite/Webpack 等常规打包器。因此 bare import（例如 `import useEmblaCarousel from 'embla-carousel-react'`）只有在 renderer 的外部模块映射中登记后才能工作。

兼容问题必须收敛在宿主层，避免每个 workflow 项目复制一份 shim：

- 宿主已有 UI 组件时，优先通过 `packages/web/src/lib/ui-exports.ts` 暴露到 `window.AgentSpacesUI` 或 `@agent-spaces/ui`。
- 宿主已有第三方依赖但 workflow 需要直接 import 时，在 `workflow-ui-renderer.tsx` 的外部模块映射中添加明确 allowlist。
- 不要在 workflow 项目内复制 `useEmblaCarousel`、日期库、图表库等宿主依赖的兼容实现。这样会导致行为分叉，也会让 renderer 的运行时约束泄漏到业务项目。
- 新增外部模块映射时，保持返回值与 Babel CommonJS transform 兼容。默认导入模块建议返回 `{ __esModule: true, default: value }`。

当前 `embla-carousel-react` 已由 renderer 映射；轮播 UI 也可以直接使用 `AgentSpacesUI` 暴露的 `Carousel`、`CarouselContent`、`CarouselItem`、`CarouselPrevious`、`CarouselNext`。

动态增删 Embla slide 时，需要在 React 提交 DOM 更新后调用 `emblaApi.reInit()`，再执行 `scrollTo()` 或读取 `canScrollPrev()` / `canScrollNext()`。否则 Embla 可能沿用初始化时的 slide 列表，表现为只能停留在第一张或导航按钮状态不更新。

### 编辑器行为

- 编辑器初始化时加载所有 `src/` 下的文件内容到内存缓存。
- 用户编辑任意文件时，缓存同步更新。
- 预览始终以主入口文件（`mainFile`）为渲染起点，通过 `files` map 解析本地 import。
- 非入口文件的修改也会触发预览刷新（因为主入口会 import 这些文件）。

### 推荐文件布局

```
project/
  manifest.json        # 项目元数据
  configs/
    config.json        # 运行时配置（readConfigJson/writeConfigJson）
  src/
    index.jsx          # 入口：组合各子组件，export default App
    components/
      Header.jsx       # 头部组件
      VoiceSelector.jsx
      AudioPlayer.jsx
      ParameterPanel.jsx
    hooks/
      useTTS.js        # 自定义 Hook（共享状态逻辑）
    utils/
      providers.js     # Provider 定义、常量
      styles.js        # 样式对象
      config.js        # 配置读写辅助函数
```

### 拆分原则

- 单文件超过 ~200 行就应该考虑拆分。
- 每个文件单一职责。
- 不要创建 barrel re-export 文件（`index.jsx` 只做 re-export），直接 import 目标文件。
- `window.AgentSpacesUI`、`window.AgentSpaces`、`window.AgentSpacesAPI` 是全局变量，不需要通过 import 传递。
- 宿主 UI 也可以通过 `import { Button } from '@agent-spaces/ui'` 获取；不要从 `@/components/...` 导入宿主内部路径。
- 第三方 bare import 只能使用 renderer allowlist 中的模块。未登记依赖不要在 workflow 项目内自行写 shim，先补 renderer 或 `ui-exports.ts`。
- 共享状态逻辑提取到 `hooks/`，纯函数和常量提取到 `utils/`。

## 相关代码

| 文件 | 说明 |
|------|------|
| `packages/web/src/components/workflows-ui/workflow-ui-renderer.tsx` | 渲染器核心，包含 Babel 编译和本地模块解析 |
| `packages/web/src/components/workflows-ui/workflow-ui-preview.tsx` | 预览容器，透传 files/mainFile 给渲染器 |
| `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` | 编辑器，加载所有文件并管理预览 |
| `packages/web/src/app/workflows-ui-preview/[id]/preview-page-client.tsx` | 独立预览页面 |
| `packages/server/src/ws/agent-prompt.ts` | Agent 提示词中的多文件布局规则 |
| `packages/server/src/services/workflow-ui.ts` | 后端 CRUD 和文件操作 |
| `packages/server/src/storage/workflow-ui-store.ts` | 存储层（JSON 文件 + 文件系统） |
