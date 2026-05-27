# React Dev Inspector 配置指南

开发环境下点击 UI 元素自动跳转到对应源码位置。

## 依赖

`packages/web/package.json` 的 `devDependencies`：

```
react-dev-inspector
@react-dev-inspector/babel-plugin
@react-dev-inspector/middleware
```

## 三层配置

### 1. Webpack Loader（注入源码位置）

`next.config.ts` 中注册自定义 loader，在 dev 模式下对 `.js/.jsx/.ts/.tsx` 文件做 Babel transform，向每个 JSX 元素注入 `data-inspector-relative-path` / `data-inspector-line` / `data-inspector-column` 属性。

Loader 实现：`packages/web/inspect-source-loader.cjs`

```js
const { transform } = require("@react-dev-inspector/babel-plugin");
module.exports = function (source) {
  return transform({
    rootPath: this.rootContext,
    filePath: this.resourcePath,
    sourceCode: source,
  });
};
```

Next.js 配置关键部分：

```ts
webpack(config, { dev }) {
  if (dev) {
    config.module.rules.push({
      test: /\.[jt]sx?$/,
      include: path.join(projectRoot, "src"),
      enforce: "pre",
      use: [{ loader: path.join(projectRoot, "inspect-source-loader.cjs") }],
    });
    // pnpm monorepo symlink 导致路径不匹配，需禁用 managedPaths
    config.snapshot ??= {};
    config.snapshot.managedPaths = [];
  }
  return config;
}
```

### 2. Server Middleware（打开编辑器）

`packages/web/server.mjs` 拦截 `/__open-in-editor?file=...` 请求，调用 `launchEditorMiddleware` 在本地 IDE 中打开文件。

```js
import { launchEditorMiddleware } from "@react-dev-inspector/middleware";

const server = http.createServer((req, res) => {
  if (dev) {
    launchEditorMiddleware(req, res, () => handle(req, res));
    return;
  }
  handle(req, res);
});
```

默认使用 VSCode。可通过环境变量 `REACT_EDITOR` 或 `EDITOR` 切换编辑器。

### 3. 前端组件（交互层）

`packages/web/src/components/dev-inspector.tsx` 提供：

- **`<Inspector>`**：`react-dev-inspector` 提供的覆盖层，鼠标悬停高亮元素
- **浮动按钮**：右下角切换 Inspector 开关
- **自定义 click handler**：点击元素时通过 `gotoServerEditor(codeInfo)` 发送请求到 server middleware

组件仅在 `NODE_ENV === "development"` 时渲染。

## 使用方式

1. `pnpm dev` 启动开发服务器
2. 页面右下角出现准星按钮，点击激活 Inspector
3. 鼠标悬停页面元素会出现蓝色边框
4. 点击目标元素，自动在编辑器中打开对应源文件并定位到行

## 可选配置

| 环境变量 | 作用 |
|---------|------|
| `REACT_EDITOR` | 指定编辑器（`code`、`webstorm`、`vim` 等） |
| `EDITOR` | 同上，优先级低于 `REACT_EDITOR` |
