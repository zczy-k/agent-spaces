# 组合节点与循环节点

本文说明两件事：

1. 当前工作流里新增的“有明确父子关系”的组合节点模型是什么。
2. 如何基于这套模型继续注册类似节点。

循环节点是第一种落地实现。它不是单个节点，而是一组有固定关系的节点：

- 可见根节点：`loop`
- 隐藏子节点：`loop_body`

创建根节点时，编辑器会自动补齐子节点和受保护连线；执行时，由根节点负责调度循环体内部的一组普通节点。

## 为什么需要组合节点

普通工作流节点只有“单节点 + 普通连线”这一层语义，不适合表达下面这类结构：

- 一个节点创建后，必须同时创建多个内部节点
- 这些内部节点之间存在固定关系，用户不能删除
- 内部节点需要隐藏，不允许手动创建
- 内部节点需要形成独立作用域，禁止跨边界连线
- 根节点需要对内部节点的执行过程做专门调度

循环节点正好具备这些特征，所以这次先抽象出“组合节点”基础设施，再用它实现 `loop`。

## 核心数据模型

相关公共类型在以下文件：

- `shared/workflow-types.ts`
- `src/lib/workflow/types.ts`
- `shared/workflow-composite.ts`
- `electron/services/plugin-types.ts`

### 节点元数据

`WorkflowNode.composite` 新增了以下字段：

- `rootId`
  组合根节点 id。整组节点共享同一个 `rootId`。
- `parentId`
  父节点 id，用于表示树状父子关系。
- `role`
  当前节点在组合结构中的角色，例如 `loop`、`loop_body`。
- `generated`
  是否为自动生成节点。自动生成节点不可手动删除、克隆、改名。
- `hidden`
  是否为隐藏节点。隐藏节点不会出现在画布中。

### 边元数据

`WorkflowEdge.composite` 新增了以下字段：

- `rootId`
  所属组合根节点 id。
- `parentId`
  生成这条边的父节点 id。
- `generated`
  是否为自动生成边。
- `hidden`
  是否为隐藏边。隐藏边不会显示在画布中。
- `locked`
  是否为锁定边。锁定边不能删除。

### 节点定义扩展

`NodeTypeDefinition` 和 `PluginWorkflowNode` 现在都支持：

- `manualCreate?: boolean`
  设为 `false` 后，节点不能从侧边栏或选择器里手动创建。
- `compound?: CompoundNodeDefinition`
  声明这个节点是组合节点根节点。
- `handles.sourceHandles`
  支持显式声明多个命名输出口。
- 属性 `visibleWhen`
  支持按其它字段值控制显隐。
- 属性类型 `output_fields`
  用于定义一组结构化输出字段，这次被复用于“中间变量”编辑器。

## 循环节点结构

循环节点定义位于：

- 前端节点注册：`src/lib/workflow/nodes/flowControl.ts`
- 内建节点声明：`electron/services/builtin-nodes.ts`

### 结构关系

`loop` 的 `compound` 定义包含两个角色：

- `loop`
  根角色，对应可见节点 `loop`
- `loop_body`
  子角色，对应隐藏节点 `loop_body`

同时还会自动生成一条内部边：

- `loop --(loop-body)--> loop_body`
- 这条边是 `hidden: true`、`locked: true`

它的作用不是让用户看见，而是给编辑器和执行器一个稳定的“循环体入口”。

### 两个出口

循环节点根节点暴露两个命名输出口：

- `loop-body`
  表示“进入循环体”
- `loop-next`
  表示“循环完成后继续”

当前执行器在执行循环体时，会显式忽略 `sourceHandle === 'loop-next'` 的边，因此它不会被当成循环体内部路径。

### 节点参数

循环节点的参数如下：

- `loopType`
  循环类型，可选：
  - `count`：按次数循环
  - `array`：使用数组循环
  - `infinite`：无限循环
- `count`
  次数。仅当 `loopType === 'count'` 时显示。
- `arrayPath`
  数组变量。仅当 `loopType === 'array'` 时显示。
- `sharedVariables`
  中间变量。类型为 `output_fields`，可以定义多个共享变量。

### 输出

循环节点根节点输出：

- `items: any[]`

它的语义是：每次迭代取“循环体最后一个被执行节点”的输出，最终收集成数组返回。

## 循环节点运行时语义

执行逻辑在以下文件：

- 后端执行器：`backend/workflow/execution-manager.ts`
- 前端单节点调试执行器：`src/lib/workflow/engine.ts`

### 1. 迭代次数

当前实现支持：

- `count`
  循环次数取 `count`
- `array`
  循环次数取 `arrayPath.length`

当前实现明确不支持：

- `infinite`
  当前版本会直接抛错，等待后续“终止循环/跳出循环”类节点接入后再开放

### 2. 循环体执行范围

执行器不会把整个工作流都当成循环体执行，而是通过隐藏子节点 `loop_body` 作为作用域锚点，只挑选属于该作用域的普通可见节点执行。

这部分依赖 `shared/workflow-composite.ts` 里的：

- `getNearestScopeAnchorId()`
- `getNodesForExecutionScope()`

当前规则是：

- 隐藏节点本身不参与普通画布渲染
- 隐藏节点可以作为作用域边界
- 只有“最近隐藏父节点”为当前 `loop_body` 的节点，才属于本次循环体
- `loop-next` 分支边不会参与循环体内部遍历

### 3. 中间变量与循环元数据

每次进入循环体时，执行器会把当前迭代上下文写到 `context.__loop__`：

- `context.__loop__.vars`
  中间变量对象，跨多次循环共享
- `context.__loop__.index`
- `context.__loop__.count`
- `context.__loop__.item`
- `context.__loop__.isFirst`
- `context.__loop__.isLast`

同时，循环节点和循环体节点在变量解析时也会暴露这些值，因此在表达式里可以使用：

```text
{{ __loop__.vars.total }}
{{ __loop__.index }}
{{ __loop__.item }}
{{ __data__["<loop节点id>"].total }}
{{ __data__["<loop_body节点id>"].$index }}
```

其中：

- `__loop__.*` 是运行时直接别名
- `__data__["<loop节点id>"]` / `__data__["<loop_body节点id>"]` 是为了兼容现有变量选择器路径格式

## 画布与编辑器约束

相关实现主要在：

- `src/stores/workflow.ts`
- `src/composables/workflow/useFlowCanvas.ts`
- `src/composables/workflow/useConnectionDrop.ts`
- `src/composables/workflow/useEdgeInsert.ts`
- `src/components/workflow/CustomNodeWrapper.vue`
- `src/components/workflow/NodeSidebar.vue`
- `src/components/workflow/NodeSelectDialog.vue`
- `src/components/workflow/NodeSelectorDailog.vue`
- `src/components/workflow/NodeProperties.vue`
- `src/components/workflow/VariablePicker.vue`

当前编辑器行为如下。

### 自动创建

新增 `loop` 时，`src/stores/workflow.ts` 中的 `createCompoundNodes()` 会：

1. 创建根节点
2. 创建所有 `compound.children`
3. 回填每个节点的 `composite.rootId / parentId / role`
4. 创建所有 `compound.edges`
5. 给内部边打上 `generated/hidden/locked`

### 隐藏节点与隐藏边

`useFlowCanvas.ts` 会过滤：

- `isHiddenWorkflowNode(node)`
- `isHiddenWorkflowEdge(edge)`

因此 `loop_body` 和根到 `loop_body` 的内部边都不会显示在画布上。

### 不能手动创建内部节点

`manualCreate: false` 的节点会被以下入口过滤掉：

- 节点侧边栏
- 节点选择对话框
- 边上“+”插入节点

所以 `loop_body` 只能由 `loop` 自动生成，不能单独创建。

### 不能删除内部节点与受保护边

在 `src/stores/workflow.ts` 中：

- `generated` 节点不可删除、不可克隆、不可改名
- `locked` 边不可删除

这保证组合结构不会被用户手动破坏。

### 不能跨作用域连线

`canConnectNodes()` 会比较 source 和 target 的“作用域拥有者”：

- 普通节点默认沿父链向上查找最近的隐藏生成节点作为作用域边界
- 如果从循环节点的 `loop-body` 出口拖线，新节点会自动归入对应 `loop_body` 作用域
- 如果 source 和 target 不在同一作用域，则拒绝连线

因此：

- 循环体内部节点不能直接连到循环体外部普通节点
- 循环体外部节点也不能直接连到循环体内部节点

## 变量选择器为什么要特殊处理

问题在于：循环根节点的最终输出 `items` 必须等整个循环执行完后才存在，但循环体内部又需要提前访问“中间变量”。

因此在 `src/components/workflow/VariablePicker.vue` 中做了一个循环节点特例：

- 如果当前节点是自动生成子节点，并且父节点定义了 `sharedVariables`
- 那么变量选择器里不再把父节点当成“普通输出节点”
- 而是把父节点替换成“父节点 / 中间变量”入口

这样循环体内部写表达式时，选择到的是父循环节点的共享变量结构，而不是尚未产生的最终输出。

## 如何注册类似节点

这里把“类似节点”分成两类。

### 第一类：只有组合结构，没有特殊调度语义

例如：

- 只是想自动创建一组辅助节点
- 子节点仍按普通工作流节点执行
- 根节点不需要像 `loop` 一样自己控制内部遍历

这种场景通常只需要声明 `compound` 即可，编辑器层能力已经具备。

#### 步骤 1：注册根节点

前端内建节点定义示例：

```ts
import type { NodeTypeDefinition } from '@/lib/workflow/types'

export const retryNode: NodeTypeDefinition = {
  type: 'retry',
  label: '重试容器',
  category: '流程控制',
  icon: 'RefreshCw',
  description: '示例：一个带隐藏子节点的组合节点',
  properties: [
    {
      key: 'maxAttempts',
      label: '最大重试次数',
      type: 'number',
      default: 3,
      required: true,
    },
  ],
  handles: {
    target: true,
    sourceHandles: [
      { id: 'retry-body', label: '重试体' },
      { id: 'retry-next', label: '完成后' },
    ],
  },
  compound: {
    rootRole: 'retry',
    children: [
      { role: 'retry', type: 'retry' },
      {
        role: 'retry_body',
        type: 'retry_body',
        label: '重试体节点',
        offset: { x: 260, y: 0 },
        hidden: true,
        parentRole: 'retry',
      },
    ],
    edges: [
      {
        sourceRole: 'retry',
        targetRole: 'retry_body',
        sourceHandle: 'retry-body',
        targetHandle: 'target',
        hidden: true,
        locked: true,
      },
    ],
  },
}
```

#### 步骤 2：注册隐藏子节点

```ts
export const retryBodyNode: NodeTypeDefinition = {
  type: 'retry_body',
  label: '重试体节点',
  category: '流程控制',
  icon: 'Ghost',
  description: '由重试容器自动生成的内部节点',
  properties: [],
  handles: {
    target: true,
    source: true,
  },
  manualCreate: false,
}
```

#### 步骤 3：同步到 Electron 内建节点声明

如果是内建节点，还需要在 `electron/services/builtin-nodes.ts` 注册同样的定义，保证主进程侧也拿到一致的节点元数据。

#### 步骤 4：确认是否需要额外 UI 接入

如果你的节点还需要下面这些能力，需要继续接入对应位置：

- 条件显隐属性：`NodeProperties.vue`
- 结构化字段编辑：`output_fields`
- 特殊变量作用域：`VariablePicker.vue`
- 自定义视图：`customView`

### 第二类：像循环节点一样，根节点要控制内部执行语义

这类节点除了 `compound` 之外，还需要扩展执行器。

适用场景：

- 循环
- 重试容器
- 事务容器
- 并行容器
- 任何“根节点决定如何遍历/重复/截断子图”的流程控制节点

#### 必须修改的位置

- `backend/workflow/execution-manager.ts`
- `src/lib/workflow/engine.ts`

原因是：

- 后端执行器负责真实工作流执行
- 前端调试执行器负责单节点调试和本地预览一致性

如果只声明 `compound`，编辑器虽然能正确创建和保护结构，但运行时仍只会把根节点当成一个普通节点，无法获得 `loop` 这种“控制内部子图执行”的语义。

#### 建议接入方式

1. 在 `dispatchNode()` 中为根节点 `type` 增加专门分支。
2. 找到对应隐藏子节点，例如通过 `findCompositeChildByRole()`。
3. 用隐藏子节点作为作用域锚点，筛选本容器内部节点。
4. 按你的语义调度内部节点。
5. 把最终结果写回根节点输出。

循环节点当前就是这样实现的。

## 插件节点如何复用这套能力

插件侧类型声明已经支持：

- `manualCreate`
- `compound`
- `visibleWhen`
- `output_fields`
- `handles.sourceHandles`

最小示例如下：

```js
module.exports = {
  nodes: [
    {
      type: 'my_group',
      label: '我的组合节点',
      category: '示例',
      icon: 'Boxes',
      description: '示例组合节点',
      properties: [],
      handles: {
        target: true,
        sourceHandles: [
          { id: 'body', label: '内部流程' },
          { id: 'next', label: '完成后' },
        ],
      },
      compound: {
        rootRole: 'my_group',
        children: [
          { role: 'my_group', type: 'my_group' },
          {
            role: 'my_group_body',
            type: 'my_group_body',
            hidden: true,
            parentRole: 'my_group',
            offset: { x: 240, y: 0 },
          },
        ],
        edges: [
          {
            sourceRole: 'my_group',
            targetRole: 'my_group_body',
            sourceHandle: 'body',
            targetHandle: 'target',
            hidden: true,
            locked: true,
          },
        ],
      },
      handler: async (_ctx, args) => {
        return {
          success: true,
          data: {
            received: args,
          },
        }
      },
    },
    {
      type: 'my_group_body',
      label: '我的组合体节点',
      category: '示例',
      icon: 'Ghost',
      description: '自动生成的内部节点',
      properties: [],
      handles: {
        target: true,
        source: true,
      },
      manualCreate: false,
      handler: async () => ({ success: true, data: {} }),
    },
  ],
}
```

但要注意一个限制：

- 插件声明的 `compound` 目前主要复用的是编辑器层的组合结构能力
- 如果你要实现的是“循环节点”这种容器型流程控制语义，当前仍需要内建执行器配合
- 也就是说，插件 `handler` 本身并不能替代 `execution-manager.ts` 对子图遍历规则的控制

因此：

- 纯结构型组合节点，可以直接放在插件里做
- 强流程控制型组合节点，建议按内建节点方式接入

## 循环节点的最小注册片段

下面是一个精简版的 `loop` / `loop_body` 定义骨架，便于后续参考：

```ts
{
  type: 'loop',
  label: '循环节点',
  category: '流程控制',
  icon: 'RotateCw',
  properties: [
    {
      key: 'loopType',
      label: '循环类型',
      type: 'select',
      default: 'count',
      options: [
        { label: '按次数循环', value: 'count' },
        { label: '使用数组循环', value: 'array' },
        { label: '无限循环', value: 'infinite' },
      ],
    },
    {
      key: 'count',
      label: '循环次数',
      type: 'number',
      visibleWhen: { key: 'loopType', equals: 'count' },
    },
    {
      key: 'arrayPath',
      label: '数组变量',
      type: 'text',
      visibleWhen: { key: 'loopType', equals: 'array' },
    },
    {
      key: 'sharedVariables',
      label: '中间变量',
      type: 'output_fields',
      default: [],
    },
  ],
  handles: {
    target: true,
    sourceHandles: [
      { id: 'loop-body', label: '循环体' },
      { id: 'loop-next', label: '完成后' },
    ],
  },
  outputs: [
    { key: 'items', type: 'any' },
  ],
  compound: {
    rootRole: 'loop',
    children: [
      { role: 'loop', type: 'loop' },
      {
        role: 'loop_body',
        type: 'loop_body',
        hidden: true,
        parentRole: 'loop',
        offset: { x: 260, y: 0 },
      },
    ],
    edges: [
      {
        sourceRole: 'loop',
        targetRole: 'loop_body',
        sourceHandle: 'loop-body',
        targetHandle: 'target',
        hidden: true,
        locked: true,
      },
    ],
  },
}
```

```ts
{
  type: 'loop_body',
  label: '循环体节点',
  category: '流程控制',
  icon: 'Ghost',
  properties: [],
  handles: {
    target: true,
    source: true,
  },
  manualCreate: false,
}
```

## 相关文件索引

如果要继续扩展这套机制，建议优先阅读这些文件：

- 类型与公共方法
  - `shared/workflow-types.ts`
  - `src/lib/workflow/types.ts`
  - `shared/workflow-composite.ts`
  - `electron/services/plugin-types.ts`
- 节点定义
  - `src/lib/workflow/nodes/flowControl.ts`
  - `electron/services/builtin-nodes.ts`
- 画布与编辑器
  - `src/stores/workflow.ts`
  - `src/composables/workflow/useFlowCanvas.ts`
  - `src/composables/workflow/useConnectionDrop.ts`
  - `src/composables/workflow/useEdgeInsert.ts`
  - `src/components/workflow/CustomNodeWrapper.vue`
  - `src/components/workflow/NodeProperties.vue`
  - `src/components/workflow/VariablePicker.vue`
- 执行器
  - `backend/workflow/execution-manager.ts`
  - `src/lib/workflow/engine.ts`

## 结论

这次新增的不是“一个特殊循环节点”，而是一套可复用的组合节点机制：

- 用 `compound` 描述一组固定父子节点和受保护边
- 用 `manualCreate: false` 隐藏内部节点的创建入口
- 用隐藏生成节点作为作用域锚点
- 用执行器分发为根节点补充容器型流程控制语义

后续如果要继续做 `retry`、`parallel`、`transaction`、`foreach-map` 一类节点，建议都沿这条路径扩展，而不是再写一次硬编码特殊逻辑。
