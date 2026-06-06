# WorkFox 插件开发指南

本文档聚焦“如何按当前架构开发插件”，不再假设所有插件都运行在 Electron 主进程。

## 开发前先选类型

写插件前先做一个决策：

### `server` 插件

适合：

- HTTP API 调用
- 文件处理
- AI 服务集成
- 需要被 Electron 和 Web 共用的工作流节点

目录：

- 开发内置插件可放 `resources/plugins/<plugin-id>`
- 用户安装后会进入 `backend/data/plugins/<plugin-id>`

### `client` 插件

适合：

- Electron 窗口控制
- 标签页交互
- 纯 UI 面板
- 必须运行在宿主客户端的能力

Electron 本地 client 插件：

- 开发态目录：`resources/plugins/<plugin-id>`

Web client 插件：

- 通过在线 manifest + CDN 加载
- 不保存为本地插件目录

## 最小目录结构

### Server 插件

```text
my-plugin/
├── info.json
├── main.js
├── workflow.js
├── tools.js
└── icon.png
```

### Electron Client 插件

```text
my-plugin/
├── info.json
├── main.js
├── view.js
├── api.js
└── icon.png
```

### Web Client 插件

仓库里通常至少有这些文件：

```text
my-plugin/
├── web-plugin.json
├── web-client.js
├── view.js
└── icon.png
```

## `info.json`

通用字段：

```json
{
  "id": "workfox.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "author": { "name": "workfox" },
  "tags": ["AI"],
  "type": "server",
  "hasWorkflow": true,
  "hasView": false,
  "config": [],
  "entries": {
    "server": "main.js",
    "client": "main.js",
    "workflow": "workflow.js",
    "tools": "tools.js",
    "api": "api.js",
    "view": "view.js"
  }
}
```

必填字段：

- `id`
- `name`
- `version`
- `description`
- `author.name`

当前最重要字段：

- `type`
  - `server`
  - `client`
  - `both`
- `hasWorkflow`
- `hasView`
- `entries`

`entries.tools` 支持两种写法。简单插件可以继续使用单文件入口：

```json
{
  "entries": {
    "tools": "tools.js"
  }
}
```

当 Agent 工具较多时，推荐按职责拆成多个文件，并在 `info.json` 中显式声明加载顺序：

```json
{
  "entries": {
    "tools": ["tools-image.js", "tools-video.js"]
  }
}
```

复杂插件不要把所有 Agent 工具都塞进默认 `tools.js`。把实际工具入口写进 `info.json`，可以避免入口约定和文件组织强绑定。

## `main.js`

生命周期入口：

```javascript
exports.activate = (context) => {
  context.logger.info('plugin activated')
}

exports.deactivate = (context) => {
  context.logger.info('plugin deactivated')
}
```

`context` 常见能力：

- `context.events`
- `context.storage`
- `context.plugin`
- `context.logger`
- `context.config`

Electron client 插件上下文会更强；Web CDN client runtime 当前提供的是较轻量上下文。

## `workflow.js`

用于定义工作流节点。`server` 插件最常见。

```javascript
module.exports = {
  nodes: [
    {
      type: 'my_node',
      label: '我的节点',
      category: '示例',
      icon: 'Image',
      description: '示例节点',
      properties: [
        { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
      ],
      handler: async (ctx, args) => {
        ctx.logger.info(`prompt=${args.prompt}`)
        return {
          success: true,
          message: 'ok',
        }
      },
    },
  ],
}
```

注意：

- `server` 插件节点由 backend 执行
- 前端单节点调试时，当前也会通过 backend `agent:execTool` 走同一条服务端执行链

## `tools.js`

给 Agent 暴露工具定义。

```javascript
module.exports = {
  tools: [
    {
      name: 'my_tool',
      description: '示例工具',
      input_schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
        required: ['prompt'],
      },
    },
  ],

  handler: async (name, args, api) => {
    if (name !== 'my_tool') {
      return { success: false, message: `未知工具: ${name}` }
    }

    return {
      success: true,
      message: `收到 ${args.prompt}`,
      data: {},
    }
  },
}
```

多文件工具入口的每个文件都使用同样的导出结构：

```javascript
module.exports = {
  tools: [
    {
      name: 'my_image_tool',
      description: '图片处理工具',
      input_schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
        required: ['prompt'],
      },
    },
  ],

  handler: async (name, args, api) => {
    if (name !== 'my_image_tool') {
      return { success: false, message: `未知工具: ${name}` }
    }

    return {
      success: true,
      message: 'ok',
      data: {},
    }
  },
}
```

拆分建议：

- 每个工具文件只放同一类能力，例如 `tools-image.js`、`tools-video.js`
- 公共请求、鉴权、轮询逻辑放到 `shared.js`，由各工具文件 `require('./shared')`
- 每个工具名必须全局唯一；不同工具文件里不要重复声明同名 `name`
- `handler` 只处理当前文件声明的工具，未知工具返回失败结果

### 复用 workflow node 与 Agent tool 定义

当同一个能力既要注册为 workflow node，又要暴露为 Agent tool，推荐把元数据和执行逻辑放在一份动作定义里，并在 `main.js` 的 `activate(context)` 中通过 `context.registerActions(actions)` 注册。插件加载器会把这份动作定义转换成 workflow nodes 和 Agent tools，避免在 `workflow.js` 和 `tools.js` 中重复维护字段、schema 和 handler。

参考 `packages/templates/plugins/aliyun_oss`：

```text
aliyun_oss/
├── actions.js      # 唯一动作定义：字段、输出、执行逻辑
├── main.js         # activate(context) 中注册 actions
├── workflow.js     # 兼容旧入口，可为空
└── tools.js        # 兼容旧入口，可为空
```

核心写法：

```javascript
// actions.js
module.exports = [
  {
    name: 'my_action',
    label: '我的节点',
    category: '示例',
    icon: 'Box',
    description: '同一份定义同时用于 workflow 和 tool',
    properties: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
    ],
    run: async (ctx, args) => {
      return { success: true, message: args.prompt }
    },
  },
]
```

```javascript
// main.js
const actions = require('./actions')

exports.activate = (context) => {
  context.registerActions(actions)
}
```

```javascript
// workflow.js
module.exports = { nodes: [] }
```

```javascript
// tools.js
module.exports = { tools: [] }
```

如两侧参数不完全一致，可在动作定义里单独提供 `toolProperties`；如某个 workflow node 不应暴露给 Agent，设置 `tool: false`。

## `api.js`

只有当你需要扩展默认 API 时再写。

```javascript
module.exports = {
  createApi: ({ windowManager }) => ({
    createManagedWindow(options) {
      return windowManager.createWindow(options)
    },
  }),
}
```

典型用途：

- Electron client 插件暴露窗口能力
- 对 handler 注入宿主侧附加服务

## `view.js`

当前设置面板通过字符串方式加载 `view.js`。

最简单写法：

```javascript
module.exports = {
  template: `
    <div class="text-sm">
      Hello plugin view
    </div>
  `,
}
```

注意：

- Electron 本地插件：`view.js` 从本地目录读取
- Web CDN client 插件：`view.js` 从 manifest 指向的 URL 拉取
- 当前实现对 `view.js` 的执行方式比较轻量，复杂依赖不建议直接塞进这里

## Web Client 插件 Manifest

Web client 插件需要单独 manifest。

示例：

```json
{
  "id": "workfox.test-plugin",
  "name": "Test Plugin",
  "version": "1.0.0",
  "description": "Web client plugin",
  "author": { "name": "workfox" },
  "type": "client",
  "runtimeTargets": ["web", "electron"],
  "iconUrl": "https://example.com/icon.png",
  "entries": {
    "client": {
      "url": "https://example.com/web-client.js",
      "format": "esm"
    },
    "view": {
      "url": "https://example.com/view.js",
      "format": "cjs"
    }
  }
}
```

当前要求：

- `entries.client.url` 可被浏览器 `import()`
- `entries.view.url` 当前按文本拉取

## 配置系统

在 `info.json` 中声明：

```json
{
  "config": [
    {
      "key": "apiKey",
      "label": "API Key",
      "type": "string",
      "value": "",
      "required": true
    }
  ]
}
```

读取方式：

- `context.config.apiKey`
- workflow 运行时也会把插件配置加载到 `__config__`

## 当前推荐实践

1. 能做成 `server` 的不要做成 `client`
2. 依赖 Electron API 的插件必须是 `client`
3. 非必要不要继续新增 `both`
4. Web client 插件必须提供 `manifestUrl`
5. 插件商店条目必须写清：
   - `type`
   - `runtimeTargets`
   - `manifestUrl`（如果是 Web client）

## 当前仓库里的参考实现

### Server 插件参考

- `resources/plugins/jimeng`
- `resources/plugins/fetch`
- `resources/plugins/file-system`
- `resources/plugins/fish-audio`

### Electron Client 插件参考

- `resources/plugins/window-manager`

### Web Client Manifest 参考

- `resources/plugins/test-plugin/web-plugin.json`
- `resources/plugins/test-plugin/web-client.js`
- `resources/plugins/test-plugin/view.js`
