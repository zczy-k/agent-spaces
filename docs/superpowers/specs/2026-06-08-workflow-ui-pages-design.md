# Workflow UI 自定义页面系统设计

> 日期：2026-06-08
> 状态：Draft

## 概述

Workflow UI 是一个自定义页面导入、编辑和运行系统。用户可以导入 ZIP 压缩包（包含 React 组件或 HTML 页面），通过在线代码编辑器修改源码，右侧实时预览效果，右下角 AI 聊天助手辅助开发。支持插件 tools 集成和宿主 UI 组件注入。

## 架构方案：轻量注入模式

选择最小化新增基础设施、最大化复用现有系统的方案。核心思路是参考 Mira Dashboard 的 `window.MiraDashboardUI` 模式，将宿主 UI 组件和插件能力通过 `window` 全局对象暴露给导入的页面代码。

### 关键决策

| 决策 | 结论 |
|------|------|
| 页面类型 | 混合模式：React 组件动态加载 + HTML 直接渲染 |
| AI 聊天 | 复用 Agent Preset（6 种运行时），通过 function call tools 渐进式发现插件 |
| 预览渲染 | 宿主内直接渲染（信任导入组件，无沙箱隔离） |
| 存储 | 全局存储（`~/.agent-spaces-data/workflows-ui/`） |
| 预览触发 | 可切换模式（自动 debounce / 手动） |

---

## 1. 数据模型与存储

### 存储目录

```
~/.agent-spaces-data/workflows-ui/
  index.json                          # 所有项目列表元数据
  {projectId}/
    manifest.json                     # 项目元信息
    src/                              # 源码文件
      index.jsx                       # React 入口（react 模式）
      index.html                      # HTML 入口（html 模式）
      ...其他文件
    assets/                           # 静态资源（图片等）
```

### Manifest 类型

```typescript
interface WorkflowUiProject {
  id: string;
  name: string;
  description?: string;
  version: string;
  // 'react' — JSX/TSX，宿主内动态编译渲染
  // 'html'  — HTML+JS，宿主内直接渲染
  type: 'react' | 'html';
  tags?: string[];
  enabledPlugins?: string[];          // 启用的插件 ID 列表
  agentConfigId?: string;             // 关联的 Agent Preset ID（AI 聊天用）
  mainFile: string;                   // 入口文件路径
  createdAt: string;
  updatedAt: string;
  // 商店来源信息
  storeUrl?: string;
  storeChecksum?: string;
}
```

### 后端 API

路由文件：`packages/server/src/routes/workflow-ui.ts`

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/workflows-ui` | GET | 列出所有项目 |
| `/api/workflows-ui` | POST | 创建项目（multipart：manifest + 源码文件） |
| `/api/workflows-ui/:id` | GET | 获取项目详情 |
| `/api/workflows-ui/:id` | PUT | 更新 manifest |
| `/api/workflows-ui/:id` | DELETE | 删除项目 |
| `/api/workflows-ui/:id/files` | GET | 获取文件树 |
| `/api/workflows-ui/:id/files/content` | GET/PUT | 读写文件内容 |
| `/api/workflows-ui/import` | POST | 导入 ZIP（解压到新项目目录） |
| `/api/workflows-ui/store` | GET | 浏览在线商店（代理 templates 仓库） |
| `/api/workflows-ui/store/:templateId/install` | POST | 从商店安装 |

插件 tools 执行：

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/plugins/:pluginId/tools` | GET | 获取插件 tools 列表 |
| `/api/plugins/:pluginId/tools/execute` | POST | 执行插件 tool（`{ name, args }`） |

### SDK 模块

`packages/sdk/modules/workflow-ui.ts`：对应上述 API 的适配器。

### 后端服务

`packages/server/src/services/workflow-ui.ts`：项目 CRUD、ZIP 解压、文件读写。

`packages/server/src/storage/workflow-ui-store.ts`：JSON 文件持久化。

---

## 2. 前端路由与页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/workflows-ui` | 列表页 | 浏览/搜索/导入/新建/管理项目 |
| `/workflows-ui/[id]` | 编辑页 | 代码编辑 + 实时预览 + AI 聊天 |

### 列表页 `WorkflowsUiPage`

复用 `WorkflowsPage`（`packages/web/src/components/workflows/workflows-page.tsx`）布局模式：

- **搜索 + 标签过滤**：同 workflows-page 模式
- **导入按钮**：接受 `.zip` 文件（非 `.json`），调用 `POST /api/workflows-ui/import`
- **新建按钮**：弹出对话框选择类型（react / html），创建空项目骨架后跳转编辑页
- **商店按钮**：弹出商店对话框，浏览在线模板，一键安装
- **卡片网格**：展示项目卡片（名称、描述、类型标签、标签、预览缩略图）

组件文件：
- `packages/web/src/components/workflows-ui/workflows-ui-page.tsx`
- `packages/web/src/components/workflows-ui/workflows-ui-card.tsx`
- `packages/web/src/components/workflows-ui/workflows-ui-store-dialog.tsx`
- `packages/web/src/components/workflows-ui/workflows-ui-create-dialog.tsx`

### 编辑页 `WorkflowUiEditor`

三区布局 + 浮动 AI 聊天：

```
┌──────────────────────┬──────────────────────────┐
│                      │                          │
│   代码编辑器         │     实时预览区            │
│   (Monaco)           │                          │
│                      │     React: Babel 编译渲染 │
│   文件树 + 标签页    │     HTML: 直接渲染        │
│                      │                          │
│                      ├──────────────────────────┤
│                      │  预览工具栏               │
│                      │  [自动/手动] [刷新] [插件] │
├──────────────────────┴──────────────────────────┤
│   底部状态栏：项目名 | 类型 | 关联Agent | 插件数  │
└─────────────────────────────────────────────────┘
                                    ┌──────────┐
                                    │ AI 聊天  │  ← FloatingChatPanel
                                    │ 助手     │    右下角浮动
                                    └──────────┘
```

**左侧编辑器**：
- 复用现有 Monaco 编辑器基础设施（editor-panel / Monaco 实例）
- 文件树（`GET /api/workflows-ui/:id/files`）
- 多标签页编辑
- 保存时写入后端（`PUT /api/workflows-ui/:id/files/content`）

**右侧预览区**：
- 工具栏：自动/手动切换、手动刷新按钮、插件 tools 列表按钮
- React 模式：Babel standalone 编译 JSX → `new Function()` → React 组件渲染到容器 div
- HTML 模式：`dangerouslySetInnerHTML` 渲染 + 手动 eval 执行 script 标签
- 自动模式：编辑后 800ms debounce 触发重新渲染
- 手动模式：点击刷新按钮触发

**底部状态栏**：
- 项目名称 | 页面类型（react/html）| 关联 Agent 名称 | 已启用插件数量

组件文件：
- `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` — 主编辑器
- `packages/web/src/components/workflows-ui/workflow-ui-file-tree.tsx` — 文件树
- `packages/web/src/components/workflows-ui/workflow-ui-preview.tsx` — 预览区
- `packages/web/src/components/workflows-ui/workflow-ui-preview-toolbar.tsx` — 预览工具栏
- `packages/web/src/components/workflows-ui/workflow-ui-plugin-tools-dialog.tsx` — 插件 tools 对话框

---

## 3. 通用组件导出与动态加载

### 宿主 UI 组件导出

新建 `packages/web/src/lib/ui-exports.ts`，将 `components/ui` 下的通用组件统一导出：

```typescript
export { Button } from '@/components/ui/button';
export { Input } from '@/components/ui/input';
export { Badge } from '@/components/ui/badge';
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export { ScrollArea } from '@/components/ui/scroll-area';
export { Separator } from '@/components/ui/separator';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export { Switch } from '@/components/ui/switch';
export { Slider } from '@/components/ui/slider';
export { Progress } from '@/components/ui/progress';
export { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
export { Checkbox } from '@/components/ui/checkbox';
// ... 按需导出更多组件
```

### 运行时注入

编辑页 mount 时挂载到 `window`，卸载时清理：

```typescript
import * as AgentSpacesUI from '@/lib/ui-exports';

useEffect(() => {
  (window as any).AgentSpacesUI = AgentSpacesUI;
  (window as any).AgentSpacesAPI = {
    executePluginTool: (pluginId: string, toolName: string, args: Record<string, any>) =>
      sdk.plugin.executeTool(pluginId, toolName, args),
    getAvailableTools: async () => {
      // 遍历 enabledPlugins，返回 [{ pluginId, toolName, description, inputSchema }]
    },
  };
  return () => {
    delete (window as any).AgentSpacesUI;
    delete (window as any).AgentSpacesAPI;
  };
}, []);
```

### React 组件动态编译

编译流程：
1. 读取入口文件 `src/index.jsx` 的源码
2. 使用 `@babel/standalone`（浏览器端 Babel）将 JSX 编译为 `React.createElement` 调用
3. 通过 `new Function()` 执行编译产物，传入 `React` 和 `window.AgentSpacesUI` 作为参数
4. 返回 React 组件，直接渲染到预览容器

约束：
- 导入的 JSX 文件不能用 `import` 语句引入宿主组件，只能通过 `window.AgentSpacesUI` 解构
- 支持的导入：`react`、`react-dom`（由宿主注入）
- 必须有 default export

示例写法：

```jsx
const { Button, Card, CardContent } = window.AgentSpacesUI;

function App() {
  return (
    <Card>
      <CardContent>
        <Button onClick={() => alert('clicked')}>Hello</Button>
      </CardContent>
    </Card>
  );
}

export default App;
```

### HTML 模式

HTML 模式也直接渲染在宿主 DOM 中：

```typescript
<div dangerouslySetInnerHTML={{ __html: htmlContent }} className="preview-container" />
```

- `window.AgentSpacesUI` 和 `window.AgentSpacesAPI` 同样可用
- HTML 中的 `<script>` 标签需手动提取并 eval（`dangerouslySetInnerHTML` 不执行 script）
- 与 React 模式共享同一套宿主上下文

---

## 4. 插件 Tools 集成

### Agent 渐进式发现

参考 `workflow-editor-tools.ts` 的模式，新建 `packages/server/src/services/builtin-tools/workflow-ui-tools.ts`，为 Agent 注册 3 个 function call tools：

**1. `list_plugin_tools`** — 列出已启用插件的可用 tools

```typescript
{
  name: 'list_plugin_tools',
  description: '列出当前 UI 项目已启用插件注册的所有 tools，返回轻量摘要（name/description）。执行陌生 tool 前必须先调用 get_plugin_tool_detail 查看 schema。',
  inputSchema: {
    pluginId: { type: 'string', description: '可选，按插件 ID 筛选' },
    keyword: { type: 'string', description: '可选，模糊搜索 tool 名称或描述' },
  },
  execute: async (input) => {
    // 遍历 manifest.enabledPlugins
    // 调用 getPluginTools(pluginId) 获取每个插件的 tools
    // 过滤匹配的 tools，返回摘要列表
  },
}
```

**2. `get_plugin_tool_detail`** — 查看插件 tool 详细 schema

```typescript
{
  name: 'get_plugin_tool_detail',
  description: '查看指定插件 tool 的完整 input_schema 和描述。执行 tool 前建议先调用此工具查看参数要求。',
  inputSchema: {
    pluginId: { type: 'string', description: '插件 ID' },
    toolName: { type: 'string', description: 'Tool 名称' },
  },
  execute: async (input) => {
    // 调用 getPluginTools(pluginId)
    // 找到对应 tool，返回完整 description + input_schema
  },
}
```

**3. `execute_plugin_tool`** — 执行插件 tool

```typescript
{
  name: 'execute_plugin_tool',
  description: '执行指定插件的 tool 并返回结果。执行前必须先调用 get_plugin_tool_detail 确认参数格式。',
  inputSchema: {
    pluginId: { type: 'string', description: '插件 ID' },
    toolName: { type: 'string', description: 'Tool 名称' },
    args: { type: 'object', description: 'Tool 参数' },
  },
  execute: async (input) => {
    // 调用 executePluginTool(pluginId, toolName, args, createBuiltinPluginApi())
    // 返回结果
  },
}
```

### Agent 交互流程

1. 用户问「帮我处理数据」→ Agent 调用 `list_plugin_tools` → 发现 `my-plugin.process_data` tool
2. Agent 调用 `get_plugin_tool_detail` → 查看 `process_data` 的 input_schema
3. Agent 构造参数 → 调用 `execute_plugin_tool` → 获取结果
4. Agent 根据结果帮用户修改代码

### 前端 UI 代码中的插件 tools 调用

导入的 UI 组件也可以直接通过 `window.AgentSpacesAPI` 调用插件 tool：

```jsx
const api = window.AgentSpacesAPI;

async function handleClick() {
  const result = await api.executePluginTool('my-plugin-id', 'process_data', { input: 'hello' });
  console.log(result);
}
```

### 插件管理交互

- 工具栏「插件」按钮 → 弹出已启用插件列表 + 每个 plugin 展开的 tools 列表
- 每个 tool 可点击「测试执行」→ 弹出参数输入表单 → 调用 `/api/plugins/:pluginId/tools/execute` → 显示结果
- 新增/移除启用插件 → 更新 `manifest.enabledPlugins` → 刷新 `window.AgentSpacesAPI`

---

## 5. AI 聊天助手

### Agent 选择与启动

- 复用现有 Agent Preset 系统（6 种运行时）
- `manifest.agentConfigId` 保存用户选择的 Agent
- 首次打开未关联 Agent 时，显示 Agent 选择器（复用 `agent-picker-dialog`）
- 已关联时直接显示 `FloatingChatPanel`

### 上下文注入

前端发送消息时附带 `workflowUiContext`：

```typescript
{
  agentConfigId: '...',
  message: '用户消息',
  workflowUiContext: {
    projectId: 'xxx',
    activeFilePath: 'src/index.jsx',
    projectDir: '~/.agent-spaces-data/workflows-ui/xxx/src/',
    fileContent: '当前编辑文件内容（可选）',
  }
}
```

后端拼接到 systemPrompt：

```
你正在辅助用户编辑一个自定义 UI 页面。
项目目录: {projectDir}
当前编辑文件: {activeFilePath}

你可以通过 list_plugin_tools / get_plugin_tool_detail / execute_plugin_tool
三个工具渐进式发现和使用当前项目已启用的插件 tools。
执行陌生 tool 前必须先调用 get_plugin_tool_detail 查看 schema。
```

### FloatingChatPanel 集成

复用 `packages/web/src/components/ui/floating-chat-widget.tsx` 的 `FloatingChatPanel`：

```typescript
<FloatingChatPanel
  isOpen={chatOpen}
  onClose={() => setChatOpen(false)}
  onToggle={() => setChatOpen(!chatOpen)}
  agent={{ name: preset.name, avatar: preset.avatar, status: sending ? 'typing' : 'online' }}
  messages={chatMessages}
  sending={sending}
  input={chatInput}
  onInputChange={setChatInput}
  onSend={handleSend}
  onStop={handleStop}
  workspaceId={workspaceId}
  width={400}
  height={360}
  headerActions={<AgentPickerButton />}
/>
```

消息流程：
1. 用户输入 → `onSend` → 构造 `channel.message` WebSocket 事件 + `workflowUiContext`
2. 后端注入上下文 + 注册 `workflow-ui-tools` function call tools → 启动 Agent
3. Agent 通过 `agent.output` 流式返回 → 更新 `chatMessages`
4. 完成 → `agent.completed` → `sending=false`

### 切换 Agent

`FloatingChatPanel` 的 `headerActions` 插槽放置设置按钮，点击弹出 Agent 选择器。切换后清空消息历史，更新 `manifest.agentConfigId`。

---

## 6. 涉及文件清单

### 后端新增

| 文件 | 职责 |
|------|------|
| `packages/server/src/routes/workflow-ui.ts` | REST API 路由（CRUD + 文件 + 导入 + 商店） |
| `packages/server/src/services/workflow-ui.ts` | 业务逻辑（项目 CRUD、ZIP 解压、文件读写） |
| `packages/server/src/storage/workflow-ui-store.ts` | JSON 持久化（index.json + per-project manifest） |
| `packages/server/src/services/builtin-tools/workflow-ui-tools.ts` | Agent function call tools（list/get_detail/execute_plugin_tool） |

### 前端新增

| 文件 | 职责 |
|------|------|
| `packages/web/src/app/workflows-ui/page.tsx` | 列表页路由 |
| `packages/web/src/app/workflows-ui/[id]/page.tsx` | 编辑页路由 |
| `packages/web/src/components/workflows-ui/workflows-ui-page.tsx` | 列表页组件 |
| `packages/web/src/components/workflows-ui/workflows-ui-card.tsx` | 项目卡片 |
| `packages/web/src/components/workflows-ui/workflows-ui-create-dialog.tsx` | 新建对话框 |
| `packages/web/src/components/workflows-ui/workflows-ui-store-dialog.tsx` | 商店对话框 |
| `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` | 主编辑器 |
| `packages/web/src/components/workflows-ui/workflow-ui-file-tree.tsx` | 文件树 |
| `packages/web/src/components/workflows-ui/workflow-ui-preview.tsx` | 预览区（React 编译 + HTML 渲染） |
| `packages/web/src/components/workflows-ui/workflow-ui-preview-toolbar.tsx` | 预览工具栏 |
| `packages/web/src/components/workflows-ui/workflow-ui-plugin-tools-dialog.tsx` | 插件 tools 管理对话框 |
| `packages/web/src/lib/ui-exports.ts` | 通用 UI 组件统一导出 |

### SDK 新增

| 文件 | 职责 |
|------|------|
| `packages/sdk/modules/workflow-ui.ts` | Workflow UI API 适配器 |

### 后端修改

| 文件 | 修改 |
|------|------|
| `packages/server/src/app.ts` | 注册 `workflow-ui` 路由 |
| `packages/server/src/services/plugin.ts` | 无需修改，已有 `getPluginTools()` 和 `executePluginTool()` |
| `packages/server/src/services/builtin-tools/index.ts` | 注册 `workflow-ui-tools` |
| `packages/server/src/ws/agent-prompt.ts` | 支持 `workflowUiContext` 注入 |

### 前端修改

| 文件 | 修改 |
|------|------|
| `packages/web/src/lib/sdk.ts` | 注册 workflow-ui SDK 模块 |
