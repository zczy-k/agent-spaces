# 内置工作流节点注册指南

本文面向 LLM 或代码生成 Agent：目标是在当前代码结构下，快速、正确地新增内置工作流节点，并尽量发挥节点定义里的 UI、连线、输入输出和组合能力。

## 先看注册入口

当前内置节点定义拆在：

- `electron/services/nodes/flow-control.ts`
- `electron/services/nodes/ai.ts`
- `electron/services/nodes/display.ts`

统一入口是 `electron/services/nodes/index.ts`：

```ts
const allNodes: PluginWorkflowNode[] = [
  ...flowControlNodes,
  ...aiNodes,
  ...displayNodes,
]

export const builtinNodeDefinitions: PluginWorkflowNode[] = allNodes.map((node) => ({
  allowInputFields: true,
  ...node,
}))
```

这意味着：

- 新节点通常只需要加入对应分类文件的数组。
- `allowInputFields` 默认会被设置为 `true`，节点属性面板会显示“输入字段”编辑区。
- 如果某个节点不希望支持输入字段，可以在节点定义中显式写 `allowInputFields: false`，因为展开顺序是先给默认值，再展开节点自身字段。
- `electron/services/builtin-nodes.ts` 只是转发入口，不要优先在里面直接追加节点。

## 最小新增流程

1. 根据节点用途选择文件：
   - 流程、控制、变量、画布辅助：`flow-control.ts`
   - AI 调用、模型、Agent：`ai.ts`
   - 展示、交互 UI、媒体和数据视图：`display.ts`
2. 在对应 `PluginWorkflowNode[]` 数组末尾追加节点对象。
3. 确保 `type` 全局唯一，使用稳定的 snake_case。
4. 给出清晰的 `label`、`category`、`icon`、`description`。
5. 用 `properties` 声明配置表单，用 `outputs` 声明下游可选择的输出结构。
6. 如果节点需要特殊执行逻辑，仅注册定义还不够，还要到后端执行器或插件 handler 链路中实现运行时行为。

## 基础模板

```ts
{
  type: 'my_node',
  label: '我的节点',
  category: '展示',
  icon: 'Box',
  description: '一句话说明节点作用和关键行为。',
  properties: [
    {
      key: 'title',
      label: '标题',
      type: 'text',
      required: true,
      placeholder: '请输入标题',
      tooltip: '显示在节点运行或展示结果中的标题。',
    },
    {
      key: 'mode',
      label: '模式',
      type: 'select',
      default: 'simple',
      options: [
        { label: '简单', value: 'simple' },
        { label: '高级', value: 'advanced' },
      ],
    },
  ],
  outputs: [
    { key: 'result', type: 'string' },
    { key: 'metadata', type: 'object' },
  ],
}
```

## 节点顶层字段

| 字段 | 必填 | 用途 |
| --- | --- | --- |
| `type` | 是 | 节点类型唯一标识。写 snake_case，不要改已有 type，否则旧工作流会失效。 |
| `label` | 是 | UI 展示名，建议中文、短名。 |
| `category` | 是 | 侧边栏分组名，例如 `流程控制`、`AI`、`展示`。 |
| `icon` | 否 | 图标名，当前通常使用 lucide 图标名，如 `Bot`、`Table`、`Terminal`。 |
| `description` | 是 | 给用户和 LLM 理解节点用途的说明。 |
| `properties` | 否 | 节点配置表单。无配置时写 `[]`。 |
| `handles` | 否 | 控制输入/输出连接点，以及多出口。 |
| `outputs` | 否 | 声明节点输出字段，供变量选择器和下游节点使用。 |
| `customViewMinSize` | 否 | 自定义展示节点的最小尺寸。 |
| `manualCreate` | 否 | 设为 `false` 后不出现在手动创建入口，适合内部节点。 |
| `compound` | 否 | 组合节点声明，例如循环节点自动生成子节点。 |
| `allowInputFields` | 否 | 控制属性面板是否显示输入字段，内置节点默认 `true`。 |

## properties 写法

`properties` 决定节点属性面板展示什么输入控件，也会影响创建节点时的默认 `data`。

支持的 `type`：

- `text`：单行文本。
- `textarea`：多行文本，适合 prompt、说明、路径列表。
- `number`：数字输入。
- `select`：下拉选项，必须提供 `options`。
- `checkbox`：布尔值。
- `code`：代码编辑器，适合 JS 代码。
- `array`：数组编辑器，配合 `itemTemplate` 和 `fields`。
- `conditions`：条件列表，主要给 `switch` 使用。
- `output_fields`：输出字段选择/定义器，适合变量聚合、循环中间变量等。

常用属性字段：

| 字段 | 用途 |
| --- | --- |
| `key` | 写入节点 `data` 的字段名，必须稳定。 |
| `label` | UI 标签。 |
| `required` | 是否必填。 |
| `default` | 创建节点时写入的默认值。 |
| `options` | `select` 选项。 |
| `tooltip` | 字段说明，建议写清变量格式、运行时语义。 |
| `placeholder` | 输入占位。 |
| `visibleWhen` | 按其它字段值控制显隐。 |
| `itemTemplate` | `array` 新增项的默认结构。 |
| `fields` | `array` 每一项的内部字段定义。 |

### 条件显隐

当字段只在某个模式下有效时，使用 `visibleWhen`，避免 UI 暴露无效配置。

```ts
{
  key: 'count',
  label: '循环次数',
  type: 'number',
  default: 1,
  required: true,
  visibleWhen: { key: 'loopType', equals: 'count' } as any,
}
```

也可以使用 `in`：

```ts
visibleWhen: { key: 'mode', in: ['advanced', 'debug'] } as any
```

### 数组字段

数组适合声明列表、表格列、资源列表、批量任务等。

```ts
{
  key: 'items',
  label: '资源列表',
  type: 'array',
  required: true,
  itemTemplate: { id: '', src: '', type: 'image', caption: '' },
  fields: [
    { key: 'src', label: '资源地址', type: 'text', required: true },
    {
      key: 'type',
      label: '类型',
      type: 'select',
      default: 'image',
      options: [
        { label: '图片', value: 'image' },
        { label: '视频', value: 'video' },
      ],
    },
    { key: 'caption', label: '标题', type: 'text' },
  ],
}
```

## handles 连接点

不写 `handles` 时，默认有输入和输出连接点。

### 入口或出口节点

```ts
// 只输出，不能输入
handles: { source: true, target: false } as any

// 只输入，不能输出
handles: { source: false, target: true } as any

// 无连线能力，适合便签
handles: { source: false, target: false } as any
```

### 多个固定出口

适合循环、成功/失败分支、人工确认分支。

```ts
handles: {
  target: true,
  source: true,
  sourceHandles: [
    { id: 'success', label: '成功' },
    { id: 'failure', label: '失败' },
  ],
} as any
```

### 动态出口

`dynamicSource` 会根据节点 `data` 中某个数组字段生成出口，适合条件分支。`extraCount` 常用于默认分支。

```ts
handles: {
  target: true,
  dynamicSource: { dataKey: 'conditions', extraCount: 1 },
} as any
```

## outputs 输出字段

`outputs` 是给变量选择器、下游节点和 LLM 编排工作流看的结构声明。它不会自动实现运行时返回值；运行时仍需执行器或 handler 返回对应数据。

```ts
outputs: [
  { key: 'text', type: 'string' },
  { key: 'count', type: 'number' },
  { key: 'ok', type: 'boolean' },
  { key: 'payload', type: 'object' },
  { key: 'raw', type: 'any' },
]
```

支持类型：

- `string`
- `number`
- `boolean`
- `object`
- `any`

建议：

- 输出字段要和实际执行结果同名。
- 展示节点如果会产生用户选择结果，也要声明输出，例如 `selectedRows`、`selectedCount`。
- `run_code` 这类动态返回节点，更新代码后也要同步写节点实例的 `data.outputs`，否则下游变量选择器无法准确感知字段。

## 输入字段 allowInputFields

当前内置节点入口默认给所有节点开启：

```ts
allowInputFields: true
```

开启后，属性面板会显示“输入字段”区域，用户可以为节点声明额外输入结构。适合：

- 需要从上游收集结构化参数的节点。
- 需要让 LLM 或变量选择器知道本节点期望输入的节点。
- 运行时会按用户配置读取 `inputFields` 的节点。

如果节点是纯画布辅助或内部锚点，可以关闭：

```ts
allowInputFields: false
```

## manualCreate 内部节点

当节点只应由系统自动创建，不应出现在侧边栏或选择器中，设置：

```ts
manualCreate: false as any
```

典型场景：

- 组合节点的内部子节点。
- 隐藏锚点。
- 运行时辅助节点。

当前创建入口会过滤 `manualCreate === false` 的节点。

## 组合节点 compound

当一个节点创建时必须同时创建子节点和受保护连线，使用 `compound`。循环节点就是当前参考实现。

最小形态：

```ts
{
  type: 'my_compound',
  label: '组合节点',
  category: '流程控制',
  icon: 'Workflow',
  description: '创建时自动生成内部节点。',
  properties: [],
  handles: {
    target: true,
    source: true,
    sourceHandles: [
      { id: 'body', label: '内部流程' },
      { id: 'next', label: '完成后' },
    ],
  } as any,
  compound: {
    rootRole: 'my_compound',
    children: [
      { role: 'my_compound', type: 'my_compound' },
      {
        role: 'my_compound_body',
        type: 'my_compound_body',
        label: '内部节点',
        offset: { x: 260, y: 0 },
        scopeBoundary: true,
        parentRole: 'my_compound',
        data: {},
      },
    ],
    edges: [
      {
        sourceRole: 'my_compound',
        targetRole: 'my_compound_body',
        sourceHandle: 'body',
        targetHandle: 'target',
        locked: true,
      },
    ],
  } as any,
}
```

同时要注册内部节点定义：

```ts
{
  type: 'my_compound_body',
  label: '内部节点',
  category: '流程控制',
  icon: 'Container',
  description: '组合节点自动生成的内部锚点，用户不可手动创建。',
  properties: [],
  handles: {
    target: true,
    source: false,
  } as any,
  manualCreate: false as any,
}
```

组合节点不要只注册定义，还要确认执行器理解它的运行时语义。详见 `docs/compound-workflow-nodes.md`。

## 自定义展示和交互节点

注册定义只能让节点出现在节点库和属性面板里。如果节点需要自定义画布内容或用户交互，还要补前端和后端逻辑。

常见步骤：

1. 在内置节点定义中注册 `properties`、`outputs` 和必要的 `customViewMinSize`。
2. 在前端节点注册或 wrapper 中接入对应 `customView` / `customViewProps`。
3. 如果运行时需要暂停等待用户操作，在后端执行器中发起 interaction。
4. 在 `src/lib/backend-api/interaction.ts` 注册 UI interaction type。

交互式节点参考 `docs/interactive-nodes.md`，表格展示节点是当前主要样例。

## 执行逻辑在哪里补

只改 `electron/services/nodes/*.ts` 的效果是“注册节点定义”，主要影响：

- 节点侧边栏和选择器。
- 属性面板。
- 默认节点数据。
- 变量选择器可见输出字段。
- 连线口显示和连线行为。

如果节点要真正运行，需要确认执行路径：

- 内置固定节点：通常在 `backend/workflow/execution-manager.ts` 和必要的前端调试执行器里加分支。
- 插件节点：在插件 `workflow.js` 中提供 `handler`，注册器会保存 handler，但暴露给前端的定义会移除 handler。
- Agent 工具：通过插件 `tools.js` 注册工具 schema 和 handler。

新增内置节点时，不要把 `handler` 写进内置节点定义后就认为会自动执行；内置节点执行主要由执行器识别 `type`。

## LLM 新增节点检查清单

生成代码前先回答：

- 节点属于哪个分类文件？
- `type` 是否全局唯一且稳定？
- `properties` 是否覆盖全部用户需要配置的输入？
- 每个有默认值的字段是否写了 `default`？
- `select` 是否写了完整 `options`？
- 条件字段是否用了 `visibleWhen` 隐藏无效配置？
- 列表型配置是否用了 `array + itemTemplate + fields`？
- 是否需要禁用或定制 `handles`？
- 是否需要多出口或动态出口？
- 是否声明了和运行时返回一致的 `outputs`？
- 是否需要关闭 `allowInputFields`？
- 是否是内部节点，需要 `manualCreate: false`？
- 是否是组合、交互或自定义视图节点，需要同步改执行器/前端？
- 是否需要更新相关文档或测试？

## 常见节点类型范式

### 纯配置执行节点

适合 HTTP 请求、文件处理、AI 调用等。

```ts
{
  type: 'http_request',
  label: 'HTTP 请求',
  category: '流程控制',
  icon: 'Globe',
  description: '发送 HTTP 请求并返回响应。',
  properties: [
    { key: 'url', label: 'URL', type: 'text', required: true },
    {
      key: 'method',
      label: '方法',
      type: 'select',
      default: 'GET',
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
      ],
    },
    {
      key: 'body',
      label: '请求体',
      type: 'textarea',
      visibleWhen: { key: 'method', in: ['POST', 'PUT', 'PATCH'] } as any,
    },
  ],
  outputs: [
    { key: 'status', type: 'number' },
    { key: 'headers', type: 'object' },
    { key: 'body', type: 'any' },
  ],
}
```

### 画布辅助节点

适合便签、分组标题等，不参与执行。

```ts
{
  type: 'canvas_note',
  label: '画布备注',
  category: '流程控制',
  icon: 'StickyNote',
  description: '画布注释节点，不影响工作流执行。',
  properties: [
    { key: 'content', label: '内容', type: 'textarea' },
  ],
  handles: {
    target: false,
    source: false,
  } as any,
  allowInputFields: false,
}
```

### 展示选择节点

适合表格、列表、图片选择等。注意输出用户操作结果。

```ts
{
  type: 'item_picker',
  label: '条目选择',
  category: '展示',
  icon: 'ListChecks',
  description: '展示条目列表，并在用户确认后输出选择结果。',
  properties: [
    {
      key: 'items',
      label: '条目列表',
      type: 'array',
      required: true,
      itemTemplate: { id: '', title: '', value: '' },
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'title', label: '标题', type: 'text', required: true },
        { key: 'value', label: '值', type: 'text' },
      ],
    },
    {
      key: 'selectionMode',
      label: '选择模式',
      type: 'select',
      default: 'single',
      options: [
        { label: '单选', value: 'single' },
        { label: '多选', value: 'multi' },
      ],
    },
  ],
  outputs: [
    { key: 'selectedItems', type: 'any' },
    { key: 'selectedCount', type: 'number' },
  ],
  customViewMinSize: { width: 260, height: 160 },
}
```

