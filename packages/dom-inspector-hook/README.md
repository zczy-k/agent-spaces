# dom-inspector-hook

捕获页面元素的源码位置信息，支持 HTTP 静默上报、IDE 跳转、自动复制。

基于 [code-inspector-plugin](https://github.com/zh-lx/code-inspector-plugin)，支持 React、Vue 及任何框架。

## 安装

```bash
npm install dom-inspector-hook code-inspector-plugin -D
```

## 使用

### 1. 配置打包工具

在打包工具配置中引入 `code-inspector-plugin`，并使用 `createBehavior()` 关闭默认的 IDE 跳转：

<details>
<summary>Vite</summary>

```js
// vite.config.js
import { defineConfig } from 'vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default defineConfig({
  plugins: [
    codeInspectorPlugin({
      bundler: 'vite',
      behavior: createBehavior(),
    }),
  ],
})
```

</details>

<details>
<summary>Webpack</summary>

```js
// webpack.config.js
const { codeInspectorPlugin } = require('code-inspector-plugin')
const { createBehavior } = require('dom-inspector-hook')

module.exports = () => ({
  plugins: [
    codeInspectorPlugin({
      bundler: 'webpack',
      behavior: createBehavior(),
    }),
  ],
})
```

</details>

<details>
<summary>Rspack</summary>

```js
// rspack.config.js
const { codeInspectorPlugin } = require('code-inspector-plugin')
const { createBehavior } = require('dom-inspector-hook')

module.exports = {
  plugins: [
    codeInspectorPlugin({
      bundler: 'rspack',
      behavior: createBehavior(),
    }),
  ],
}
```

</details>

<details>
<summary>Next.js</summary>

Next 15.3+:

```js
// next.config.js
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default {
  turbopack: {
    rules: codeInspectorPlugin({
      bundler: 'turbopack',
      behavior: createBehavior(),
    }),
  },
}
```

Next 15.0 ~ 15.2:

```js
export default {
  experimental: {
    turbo: {
      rules: codeInspectorPlugin({
        bundler: 'turbopack',
        behavior: createBehavior(),
      }),
    },
  },
}
```

Next <= 14:

```js
module.exports = {
  webpack: (config) => {
    config.plugins.push(
      codeInspectorPlugin({
        bundler: 'webpack',
        behavior: createBehavior(),
      }),
    )
    return config
  },
}
```

</details>

<details>
<summary>Nuxt</summary>

Nuxt 3:

```js
// nuxt.config.js
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default defineNuxtConfig({
  vite: {
    plugins: [
      codeInspectorPlugin({
        bundler: 'vite',
        behavior: createBehavior(),
      }),
    ],
  },
})
```

Nuxt 2:

```js
export default {
  build: {
    extend(config) {
      config.plugins.push(
        codeInspectorPlugin({
          bundler: 'webpack',
          behavior: createBehavior(),
        }),
      )
      return config
    },
  },
}
```

</details>

<details>
<summary>Vue CLI</summary>

```js
// vue.config.js
const { codeInspectorPlugin } = require('code-inspector-plugin')
const { createBehavior } = require('dom-inspector-hook')

module.exports = {
  chainWebpack: (config) => {
    config.plugin('code-inspector-plugin').use(
      codeInspectorPlugin({
        bundler: 'webpack',
        behavior: createBehavior(),
      }),
    )
  },
}
```

</details>

<details>
<summary>Umi</summary>

Webpack:

```js
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default {
  chainWebpack(memo) {
    memo.plugin('code-inspector-plugin').use(
      codeInspectorPlugin({
        bundler: 'webpack',
        behavior: createBehavior(),
      }),
    )
  },
}
```

Mako:

```js
export default {
  mako: {
    plugins: [
      codeInspectorPlugin({
        bundler: 'mako',
        behavior: createBehavior(),
      }),
    ],
  },
}
```

</details>

<details>
<summary>Astro</summary>

```js
// astro.config.mjs
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default defineConfig({
  vite: {
    plugins: [
      codeInspectorPlugin({
        bundler: 'vite',
        behavior: createBehavior(),
      }),
    ],
  },
})
```

</details>

<details>
<summary>Rsbuild</summary>

```js
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default defineConfig({
  tools: {
    rspack: {
      plugins: [
        codeInspectorPlugin({
          bundler: 'rspack',
          behavior: createBehavior(),
        }),
      ],
    },
  },
})
```

</details>

<details>
<summary>esbuild</summary>

```js
const { codeInspectorPlugin } = require('code-inspector-plugin')
const { createBehavior } = require('dom-inspector-hook')

esbuild.build({
  plugins: [
    codeInspectorPlugin({
      bundler: 'esbuild',
      behavior: createBehavior(),
      dev: () => true,
    }),
  ],
})
```

</details>

<details>
<summary>Farm</summary>

```js
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createBehavior } from 'dom-inspector-hook'

export default defineConfig({
  vitePlugins: [
    codeInspectorPlugin({
      bundler: 'vite',
      behavior: createBehavior(),
    }),
  ],
})
```

</details>

### 2. 在应用入口绑定监听

```ts
// main.ts / main.jsx
import { bindCaptureListener } from 'dom-inspector-hook'

bindCaptureListener({
  url: 'http://127.0.0.1:3100/api/inspector/track', // POST 目标地址
})
```

### 3. 启动开发服务器

页面加载后，按住 `Alt+Shift`（Mac: `Option+Shift`）点击页面元素即可触发。

## API

### `createBehavior(options?)`

生成 `code-inspector-plugin` 的 `behavior` 配置，关闭默认 IDE 跳转。

```ts
import { createBehavior } from 'dom-inspector-hook'

createBehavior({ copy: true }) // 点击时自动复制源码位置信息
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `copy` | `boolean` | `false` | 点击时自动复制 `path:line:column` |

### `bindCaptureListener(options)`

绑定 `code-inspector:trackCode` 事件监听，处理捕获到的源码信息。

```ts
import { bindCaptureListener } from 'dom-inspector-hook'

const unbind = bindCaptureListener({
  url: 'http://127.0.0.1:3100/api/inspector/track',
  mode: 'auto',
  copy: true,
})
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | `string` | - | POST 目标地址（mode 为 `http` 或 `auto` 时需要） |
| `mode` | `'auto' \| 'http' \| 'editor'` | `'auto'` | 执行模式，见下方说明 |
| `copy` | `boolean` | `false` | 点击时自动复制源码位置到剪贴板 |
| `headers` | `Record<string, string>` | - | 自定义 POST 请求头 |

**Mode 说明：**

| Mode | 行为 |
|------|------|
| `auto` | 弹出对话框，让用户选择 "Send HTTP" 或 "Open Editor" |
| `http` | 静默 POST 到 `url`，无弹窗 |
| `editor` | 直接跳转 IDE 编辑器定位源码 |

**返回值：** `() => void` — 取消监听的函数。

### POST 数据格式

POST 请求的 JSON body：

```json
{
  "path": "/src/components/Button.tsx",
  "name": "Button",
  "line": 10,
  "column": 5,
  "timestamp": 1715961234567
}
```

## 接收端示例

```js
// server.mjs
import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      console.log(JSON.parse(body))
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end('{"ok":true}')
    })
  }
})

server.listen(3100)
```

## License

MIT
